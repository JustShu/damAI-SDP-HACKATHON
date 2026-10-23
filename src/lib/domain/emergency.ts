import { prisma } from "../db";
import { audit } from "../audit";
import { now } from "../clock";
import { AppError, badRequest, conflict, forbidden } from "../errors";
import { type Actor, requireAnyManager, requireManagerOf, requireResident } from "../actor";

// Urgent alerts ("I can see a fight right now"). These skip neighbour
// mediation entirely and go straight to community management, who can send
// security. The reporter sees every update. The app is not an emergency
// service: residents are always told to call 999 if anyone is in danger.

export const ALERT_TYPES = ["FIGHT", "INJURY", "INTRUDER", "OTHER"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  FIGHT: "Fight or violence",
  INJURY: "Someone is hurt",
  INTRUDER: "Intruder or suspicious activity",
  OTHER: "Other urgent situation",
};

export const ALERT_ACTIONS = ["ACKNOWLEDGE", "DISPATCH", "ON_SCENE", "POLICE", "RESOLVE"] as const;
export type AlertAction = (typeof ALERT_ACTIONS)[number];

export const ALERT_STATUS_LABELS: Record<string, string> = {
  NEW: "Sent to management",
  ACKNOWLEDGED: "Seen by management",
  DISPATCHED: "Security on the way",
  ON_SCENE: "Security on scene",
  POLICE: "Police contacted",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

const ACTION_RESULT: Record<AlertAction, string> = {
  ACKNOWLEDGE: "ACKNOWLEDGED",
  DISPATCH: "DISPATCHED",
  ON_SCENE: "ON_SCENE",
  POLICE: "POLICE",
  RESOLVE: "RESOLVED",
};

const CLOSED = ["RESOLVED", "CANCELLED"];
const MAX_ALERTS_PER_DAY = 5;
const DAY = 24 * 3600_000;

function updateText(action: AlertAction, etaMinutes?: number | null) {
  switch (action) {
    case "ACKNOWLEDGE":
      return "Community management has seen your alert and is responding.";
    case "DISPATCH":
      return `Security is on the way${etaMinutes ? `, expected in about ${etaMinutes} minute${etaMinutes === 1 ? "" : "s"}` : ""}. Stay at a safe distance.`;
    case "ON_SCENE":
      return "Security has arrived at the location.";
    case "POLICE":
      return "Community management has contacted the police.";
    case "RESOLVE":
      return "Community management has marked this alert as resolved. Thank you for reporting it.";
  }
}

export async function createAlert(actor: Actor, input: { type: string; location: string; details?: string }) {
  const own = requireResident(actor);
  if (!ALERT_TYPES.includes(input.type as AlertType)) throw badRequest("Choose what is happening.");
  const location = input.location.trim();
  if (location.length < 3 || location.length > 200) throw badRequest("Say where it is happening (3–200 characters).");
  const details = (input.details ?? "").trim();
  if (details.length > 1000) throw badRequest("Please keep details under 1000 characters.");

  const at = await now();
  const recent = await prisma.emergencyAlert.count({ where: { reporterUserId: actor.userId, createdAt: { gte: new Date(at.getTime() - DAY) } } });
  if (recent >= MAX_ALERTS_PER_DAY) throw new AppError(429, "You've sent several alerts today. If anyone is in danger, call 999 now.");

  const alert = await prisma.emergencyAlert.create({
    data: {
      communityId: own.communityId,
      reporterUserId: actor.userId,
      reporterHouseholdId: own.id,
      type: input.type,
      location,
      details,
      createdAt: at,
      updatedAt: at,
      updates: { create: { author: "SYSTEM", status: "NEW", body: "Your alert has been sent to community management.", createdAt: at } },
    },
  });
  // Audit never stores the free-text details.
  await audit(actor.userId, "EmergencyAlertRaised", "emergency_alert", alert.id, at, { type: input.type });
  return alert;
}

/** Reporter's own alerts (most recent first). */
export async function listMyAlerts(actor: Actor) {
  requireResident(actor);
  const alerts = await prisma.emergencyAlert.findMany({ where: { reporterUserId: actor.userId }, orderBy: { createdAt: "desc" }, take: 20 });
  return alerts.map((a) => ({ id: a.id, type: a.type, location: a.location, status: a.status, createdAt: a.createdAt, open: !CLOSED.includes(a.status) }));
}

async function loadAlert(alertId: string) {
  const a = await prisma.emergencyAlert.findUnique({ where: { id: alertId }, include: { updates: { orderBy: { createdAt: "asc" } } } });
  if (!a) throw forbidden(); // same answer as "not yours"
  return a;
}

/** The reporter, or a manager of that community, may view an alert. */
export async function getAlert(actor: Actor, alertId: string) {
  const a = await loadAlert(alertId);
  const isReporter = a.reporterUserId === actor.userId;
  const isManager = actor.managerCommunityIds.includes(a.communityId);
  if (!isReporter && !isManager) throw forbidden();

  const base = {
    id: a.id,
    type: a.type,
    location: a.location,
    details: a.details,
    status: a.status,
    etaMinutes: a.etaMinutes,
    createdAt: a.createdAt,
    open: !CLOSED.includes(a.status),
    updates: a.updates.map((u) => ({ id: u.id, author: u.author, status: u.status, body: u.body, createdAt: u.createdAt })),
  };
  if (!isManager) return { ...base, role: "REPORTER" as const };

  // Management needs to know who raised it so security can reach them.
  const [user, hh] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: a.reporterUserId } }),
    prisma.household.findUniqueOrThrow({ where: { id: a.reporterHouseholdId } }),
  ]);
  return { ...base, role: "MANAGER" as const, reporterName: user.displayName, reporterHousehold: hh.label };
}

/** Open alerts for the manager's communities, newest first. */
export async function listAlertsForManager(actor: Actor) {
  requireAnyManager(actor);
  const alerts = await prisma.emergencyAlert.findMany({
    where: { communityId: { in: actor.managerCommunityIds } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const labels = Object.fromEntries(
    (await prisma.household.findMany({ where: { id: { in: alerts.map((a) => a.reporterHouseholdId) } }, select: { id: true, label: true } })).map((h) => [h.id, h.label]),
  );
  return alerts.map((a) => ({
    id: a.id,
    type: a.type,
    location: a.location,
    status: a.status,
    createdAt: a.createdAt,
    reporterHousehold: labels[a.reporterHouseholdId] ?? "",
    open: !CLOSED.includes(a.status),
  }));
}

/** A manager responds: acknowledge, dispatch security (optional ETA), on scene, police, resolve. */
export async function actOnAlert(actor: Actor, alertId: string, input: { action: string; etaMinutes?: number; note?: string }) {
  const a = await loadAlert(alertId);
  requireManagerOf(actor, a.communityId);
  if (CLOSED.includes(a.status)) throw conflict("This alert is already closed.");
  if (!ALERT_ACTIONS.includes(input.action as AlertAction)) throw badRequest("Choose an action.");
  const action = input.action as AlertAction;
  const eta = action === "DISPATCH" && input.etaMinutes ? Math.round(input.etaMinutes) : null;
  if (eta !== null && (eta < 1 || eta > 120)) throw badRequest("ETA must be between 1 and 120 minutes.");
  const note = (input.note ?? "").trim().slice(0, 500);

  const at = await now();
  const status = ACTION_RESULT[action];
  const body = note ? `${updateText(action, eta)} Note from management: ${note}` : updateText(action, eta);
  // Compare-and-set on the previous status so two managers can't clash silently.
  const moved = await prisma.emergencyAlert.updateMany({
    where: { id: a.id, status: a.status },
    data: { status, updatedAt: at, ...(eta !== null ? { etaMinutes: eta } : {}), ...(action === "RESOLVE" ? { closedAt: at } : {}) },
  });
  if (moved.count !== 1) throw conflict("Someone else just updated this alert. Refresh and try again.");
  await prisma.emergencyUpdate.create({ data: { alertId: a.id, author: "MANAGER", status, body, createdAt: at } });
  await audit(actor.userId, "EmergencyAlertUpdated", "emergency_alert", a.id, at, { action, etaMinutes: eta });
}

/** The reporter can cancel a false alarm while it is still open. */
export async function cancelAlert(actor: Actor, alertId: string) {
  const a = await loadAlert(alertId);
  if (a.reporterUserId !== actor.userId) throw forbidden();
  if (CLOSED.includes(a.status)) throw conflict("This alert is already closed.");
  const at = await now();
  await prisma.emergencyAlert.update({ where: { id: a.id }, data: { status: "CANCELLED", updatedAt: at, closedAt: at } });
  await prisma.emergencyUpdate.create({ data: { alertId: a.id, author: "REPORTER", status: "CANCELLED", body: "The reporter cancelled this alert.", createdAt: at } });
  await audit(actor.userId, "EmergencyAlertCancelled", "emergency_alert", a.id, at);
}

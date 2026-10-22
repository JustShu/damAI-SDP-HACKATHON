import type { PrismaClient } from "@prisma/client";
import { hashText } from "./domain/privacy";
import { REMINDER_TEXT, UNRESOLVED_TO_RECIPIENT } from "./domain/copy";
import { analyseReport, summariseReply } from "./mediator/local";

// Synthetic demo data only (docs/07). Times are relative to `base` so the
// escalation scenarios always fall inside the 30-day window.

const H = 3600_000;
const D = 24 * H;

export async function resetDatabase(db: PrismaClient) {
  await db.$transaction([
    db.auditEvent.deleteMany(),
    db.managementAction.deleteMany(),
    db.reviewFlag.deleteMany(),
    db.relay.deleteMany(),
    db.message.deleteMany(),
    db.noticeDraft.deleteMany(),
    db.case.deleteMany(),
    db.incident.deleteMany(),
    db.managerAssignment.deleteMany(),
    db.membership.deleteMany(),
    db.user.deleteMany(),
    db.household.deleteMany(),
    db.community.deleteMany(),
    db.setting.deleteMany(),
  ]);
}

export async function seed(db: PrismaClient, base = new Date()) {
  await resetDatabase(db);
  const ago = (ms: number) => new Date(base.getTime() - ms);

  const park = await db.community.create({
    data: { code: "DEMO-PARK", name: "Demo Park Residences (synthetic)" },
  });
  // A second community with a clashing "House 18" proves labels are scoped.
  const hill = await db.community.create({
    data: { code: "DEMO-HILL", name: "Demo Hill Residences (synthetic)" },
  });

  const house = (communityId: string, unit: string) =>
    db.household.create({ data: { communityId, block: "A", unit, label: `House ${unit}` } });
  const h18 = await house(park.id, "18");
  const h39 = await house(park.id, "39");
  const h22 = await house(park.id, "22");
  const h25 = await house(park.id, "25");
  await house(park.id, "41");
  const hill18 = await house(hill.id, "18");

  const resident = async (email: string, displayName: string, householdId: string) =>
    db.user.create({
      data: {
        email,
        displayName,
        memberships: { create: { householdId, status: "VERIFIED", verifiedAt: ago(90 * D) } },
      },
    });
  await resident("resident18@example.test", "Nur Aisyah", h18.id);
  const u39 = await resident("resident39@example.test", "Daniel Lim", h39.id);
  const u22 = await resident("resident22@example.test", "Priya Raman", h22.id);
  const u25 = await resident("resident25@example.test", "Hafiz Osman", h25.id);
  await resident("hill18@example.test", "Mei Ling", hill18.id);
  // An unverified invite: proves an unverified person gets no resident access.
  await db.user.create({
    data: {
      email: "invited41@example.test",
      displayName: "Invited (unverified)",
      memberships: { create: { householdId: (await db.household.findFirstOrThrow({ where: { communityId: park.id, unit: "41" } })).id, status: "INVITED" } },
    },
  });
  await db.user.create({
    data: {
      email: "manager@example.test",
      displayName: "Farah (estate manager, demo)",
      managerOf: { create: { communityId: park.id } },
    },
  });

  // Helper: a case whose notice was already delivered.
  async function sentCase(opts: {
    reporter: { id: string };
    reporterHh: { id: string };
    category: "NOISE" | "PARKING" | "PET";
    occurredAgo: number;
    sentAgo: number;
    rawText: string;
    incidentId: string;
    state: string;
    reply?: { type: string; raw: string; relay: string; agoMs: number };
    reporterMarkedUnresolvedAgo?: number;
    reminderAgo?: number;
  }) {
    const occurredAt = ago(opts.occurredAgo);
    // Seeded notices come from the same built-in mediator the app uses.
    const notice = analyseReport({ category: opts.category, occurredAt, rawText: opts.rawText, tone: "FRIENDLY", attempt: 1 }).noticeText;
    const c = await db.case.create({
      data: {
        communityId: park.id,
        incidentId: opts.incidentId,
        reporterUserId: opts.reporter.id,
        reporterHouseholdId: opts.reporterHh.id,
        targetHouseholdId: h18.id,
        category: opts.category,
        occurredAt,
        rawText: opts.rawText,
        state: opts.state,
        openedAt: ago(opts.sentAgo + H),
        noticeSentAt: ago(opts.sentAgo),
        firstResponseAt: opts.reply ? ago(opts.reply.agoMs) : null,
        reminderSentAt: opts.reminderAgo !== undefined ? ago(opts.reminderAgo) : null,
      },
    });
    await db.noticeDraft.create({
      data: {
        caseId: c.id,
        version: 1,
        text: notice,
        textHash: hashText(notice),
        source: "AI",
        approvedHash: hashText(notice),
        approvedAt: ago(opts.sentAgo),
        sentAt: ago(opts.sentAgo),
        idempotencyKey: `seed-${c.id}`,
      },
    });
    const msgs = [
      { side: "REPORTER", author: "SYSTEM", kind: "STATUS", body: "Your approved notice was delivered privately to the other household. Your identity was not included.", createdAt: ago(opts.sentAgo) },
      { side: "RECIPIENT", author: "AI", kind: "NOTICE", body: notice, createdAt: ago(opts.sentAgo) },
    ];
    if (opts.reminderAgo !== undefined) {
      msgs.push({ side: "RECIPIENT", author: "AI", kind: "REMINDER", body: REMINDER_TEXT, createdAt: ago(opts.reminderAgo) });
    }
    if (opts.reply) {
      await db.relay.create({
        data: { caseId: c.id, responseType: opts.reply.type, rawText: opts.reply.raw, relayText: opts.reply.relay, status: "SENT", createdAt: ago(opts.reply.agoMs), sentAt: ago(opts.reply.agoMs) },
      });
      msgs.push(
        { side: "RECIPIENT", author: "RESIDENT", kind: "RESPONSE", body: opts.reply.raw, createdAt: ago(opts.reply.agoMs) },
        { side: "RECIPIENT", author: "SYSTEM", kind: "INFO", body: `Shared with the reporting household: "${opts.reply.relay}"`, createdAt: ago(opts.reply.agoMs) },
        { side: "REPORTER", author: "AI", kind: "RELAY", body: opts.reply.relay, createdAt: ago(opts.reply.agoMs) },
      );
    }
    if (opts.reporterMarkedUnresolvedAgo !== undefined) {
      msgs.push(
        { side: "REPORTER", author: "SYSTEM", kind: "STATUS", body: "You marked this concern as not resolved yet.", createdAt: ago(opts.reporterMarkedUnresolvedAgo) },
        { side: "RECIPIENT", author: "AI", kind: "INFO", body: UNRESOLVED_TO_RECIPIENT, createdAt: ago(opts.reporterMarkedUnresolvedAgo) },
      );
    }
    await db.message.createMany({ data: msgs.map((m) => ({ ...m, caseId: c.id })) });
    return c;
  }

  // ---- Escalation scenario: noise at House 18 -------------------------------
  // Incident 1 (6 days ago): reported twice by different households -> ONE incident.
  const inc1 = await db.incident.create({
    data: { communityId: park.id, targetHouseholdId: h18.id, category: "NOISE", occurredAt: ago(6 * D), status: "QUALIFYING_UNRESOLVED" },
  });
  const noiseReply = { type: "ACKNOWLEDGE", raw: "Ok noted.", relay: summariseReply({ category: "NOISE", responseType: "ACKNOWLEDGE", text: "Ok noted." }).relayText, agoMs: 5 * D };
  await sentCase({ reporter: u22, reporterHh: h22, category: "NOISE", occurredAgo: 6 * D, sentAgo: 6 * D - 2 * H, rawText: "Very loud music past midnight again.", incidentId: inc1.id, state: "UNRESOLVED", reply: noiseReply, reporterMarkedUnresolvedAgo: 4 * D });
  await sentCase({ reporter: u25, reporterHh: h25, category: "NOISE", occurredAgo: 6 * D - 30 * 60_000, sentAgo: 6 * D - 3 * H, rawText: "Loud party noise, could not sleep.", incidentId: inc1.id, state: "UNRESOLVED", reply: noiseReply, reporterMarkedUnresolvedAgo: 4 * D });

  // Incident 2 (3 days ago): separate occurrence, unresolved.
  const inc2 = await db.incident.create({
    data: { communityId: park.id, targetHouseholdId: h18.id, category: "NOISE", occurredAt: ago(3 * D), status: "QUALIFYING_UNRESOLVED" },
  });
  await sentCase({ reporter: u39, reporterHh: h39, category: "NOISE", occurredAgo: 3 * D, sentAgo: 3 * D - 2 * H, rawText: "Drilling and banging late at night.", incidentId: inc2.id, state: "UNRESOLVED", reply: noiseReply, reporterMarkedUnresolvedAgo: 2 * D });

  // Incident 3 (1 day ago): replied to, awaiting House 39's confirmation.
  // Marking it "not resolved" in the demo makes it the third qualifying incident.
  const inc3 = await db.incident.create({
    data: { communityId: park.id, targetHouseholdId: h18.id, category: "NOISE", occurredAt: ago(1 * D), status: "OPEN" },
  });
  await sentCase({
    reporter: u39, reporterHh: h39, category: "NOISE", occurredAgo: 1 * D, sentAgo: 1 * D - 2 * H,
    rawText: "Loud music again from 11pm, my kids couldn't sleep.", incidentId: inc3.id, state: "ASSISTED_RESOLUTION",
    reply: { type: "COMMIT", raw: "Sorry, we had guests over. We'll keep it down after 10pm.", relay: summariseReply({ category: "NOISE", responseType: "COMMIT", text: "Sorry, we had guests over. We'll keep it down after 10pm." }).relayText, agoMs: 12 * H },
  });

  // ---- Overdue scenario: unanswered pet concern, 6 days old ------------------
  // Already reminded at 72h. Advancing the demo clock by 1 day makes it overdue.
  const inc4 = await db.incident.create({
    data: { communityId: park.id, targetHouseholdId: h18.id, category: "PET", occurredAt: ago(6 * D + 2 * H), status: "OPEN" },
  });
  await sentCase({ reporter: u22, reporterHh: h22, category: "PET", occurredAgo: 6 * D + 2 * H, sentAgo: 6 * D + H, rawText: "Dog barking for hours while owners are out.", incidentId: inc4.id, state: "NOTICE_SENT", reminderAgo: 3 * D - H });

  await db.auditEvent.create({ data: { action: "DemoSeeded", resourceType: "community", resourceId: park.id, at: base } });
}

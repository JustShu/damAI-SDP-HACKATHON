import { prisma } from "./db";

// Append-only audit trail. Never pass raw complaint or reply text in metadata.
export async function audit(
  actorId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  at: Date,
  metadata: Record<string, unknown> = {},
) {
  await prisma.auditEvent.create({
    data: { actorId, action, resourceType, resourceId, at, metadata: JSON.stringify(metadata) },
  });
}

import { prisma } from "./db";

// Demo clock: real time plus an offset stored in the database, so a manager
// can "advance time" to show 72h reminders and 7-day escalation in a demo.
const KEY = "clockOffsetMs";

export async function getOffsetMs(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  return row ? Number(row.value) : 0;
}

export async function now(): Promise<Date> {
  return new Date(Date.now() + (await getOffsetMs()));
}

export async function setOffsetMs(ms: number) {
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: String(ms) },
    update: { value: String(ms) },
  });
}

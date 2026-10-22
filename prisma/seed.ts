import { PrismaClient } from "@prisma/client";
import { seed } from "../src/lib/seed";

const db = new PrismaClient();
seed(db)
  .then(() => console.log("Seeded synthetic demo data."))
  .finally(() => db.$disconnect());

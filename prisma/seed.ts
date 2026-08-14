import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PermissionName } from "../generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const permissions = Object.values(PermissionName);

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
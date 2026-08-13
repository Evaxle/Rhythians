import { PrismaClient } from "../generated/prisma/client";
import { PermissionName } from "../generated/prisma/enums";

const prisma = new PrismaClient();

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
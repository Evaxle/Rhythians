import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PermissionName } from "../generated/prisma/enums";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

const AVAILABLE_TAGS = [
  "beginner",
  "intermediate",
  "experienced",
  "expert",
  "content-creator",
  "veteran",
  "rhythian-coach",
  "tester",
  "post-reviewer",
  "mentor",
  "camera-lock",
  "camera-spin",
  "camera-vr",
];

async function main() {
  const permissions = Object.values(PermissionName);

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const tagSlug of AVAILABLE_TAGS) {
    const tagName = tagSlug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    await prisma.tag.upsert({
      where: { slug: tagSlug },
      update: {},
      create: { name: tagName, slug: tagSlug },
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

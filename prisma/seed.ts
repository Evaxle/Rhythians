import { PrismaClient, PermissionName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const permissions = Object.values(PermissionName).map((name) => ({ name, description: `${name} permission` }));
  await prisma.permission.createMany({ data: permissions, skipDuplicates: true });

  const roles = [
    { name: "guest", description: "Unauthenticated visitor", isDefault: true },
    { name: "member", description: "Authenticated community member", isDefault: false },
    { name: "contributor", description: "Content contributor", isDefault: false },
    { name: "moderator", description: "Moderator with content review permissions", isDefault: false },
    { name: "admin", description: "Administrator with full access", isDefault: false },
    { name: "owner", description: "Platform owner", isDefault: false },
  ];
  await prisma.role.createMany({ data: roles, skipDuplicates: true });

  const defaultRole = await prisma.role.findUnique({ where: { name: "member" } });
  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  const moderatorRole = await prisma.role.findUnique({ where: { name: "moderator" } });
  const contributorRole = await prisma.role.findUnique({ where: { name: "contributor" } });

  const allPermissions = await prisma.permission.findMany();
  const rolePermissionMap: Record<string, PermissionName[]> = {
    member: ["knowledge_read", "clips_submit", "clips_comment"],
    contributor: ["knowledge_read", "knowledge_create", "clips_submit", "clips_comment"],
    moderator: ["knowledge_read", "clips_moderate", "clips_delete", "users_moderate"],
    admin: [
      "knowledge_read",
      "knowledge_create",
      "knowledge_edit",
      "knowledge_publish",
      "knowledge_delete",
      "clips_submit",
      "clips_comment",
      "clips_moderate",
      "clips_delete",
      "users_view",
      "users_moderate",
      "settings_manage",
      "announcements_create",
      "announcements_delete",
      "admin_access",
    ],
    owner: [
      "knowledge_read",
      "knowledge_create",
      "knowledge_edit",
      "knowledge_publish",
      "knowledge_delete",
      "clips_submit",
      "clips_comment",
      "clips_moderate",
      "clips_delete",
      "users_view",
      "users_moderate",
      "settings_manage",
      "announcements_create",
      "announcements_delete",
      "admin_access",
    ],
  };

  for (const [roleName, permissionNames] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    for (const permissionName of permissionNames) {
      const permission = allPermissions.find((item) => item.name === permissionName);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { id: `${role.id}-${permission.id}` },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  await prisma.knowledgeCategory.createMany({
    data: [
      { name: "Getting Started", slug: "getting-started", description: "Introductory articles for new members." },
      { name: "Guides", slug: "guides", description: "Step-by-step guides and walkthroughs." },
      { name: "FAQ", slug: "faq", description: "Frequently asked questions and answers." },
      { name: "Resources", slug: "resources", description: "Helpful links and recommended tools." },
    ],
    skipDuplicates: true,
  });

  await prisma.rule.createMany({
    data: [
      { title: "Respect everyone", slug: "respect-everyone", content: "Treat every member with respect and avoid harassment.", order: 1 },
      { title: "No spam", slug: "no-spam", content: "Keep channels clear of repeated messages, self-promotion, and irrelevant links.", order: 2 },
      { title: "No advertising", slug: "no-advertising", content: "Do not advertise other servers, products, or services without permission.", order: 3 },
      { title: "Keep content appropriate", slug: "keep-content-appropriate", content: "Do not share inappropriate, illegal, or NSFW content.", order: 4 },
    ],
    skipDuplicates: true,
  });

  await prisma.clipCategory.createMany({
    data: [
      { name: "Gameplay", slug: "gameplay", description: "In-game highlights and moments." },
      { name: "Tutorial", slug: "tutorial", description: "Instructional clips and explainer videos." },
      { name: "Community", slug: "community", description: "Clips featuring community events and members." },
    ],
    skipDuplicates: true,
  });

  await prisma.siteSetting.createMany({
    data: [
      { key: "server_name", value: "Rhythians", description: "Community server name" },
      { key: "server_description", value: "A Discord community platform for knowledge, clips, and media.", description: "Homepage description" },
      { key: "discord_invite_url", value: "https://discord.gg/your-server", description: "Community Discord invite link" },
      { key: "feature_clips_enabled", value: "true", description: "Enable clip submissions" },
      { key: "feature_knowledge_enabled", value: "true", description: "Enable knowledge base" },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

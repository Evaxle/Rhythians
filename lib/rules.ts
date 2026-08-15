export type Rule = {
  slug: string;
  title: string;
  description: string;
  content: string;
};

export const rules: Rule[] = [
  {
    slug: "be-respectful",
    title: "Be respectful to everyone",
    description: "Treat every member with kindness and respect, no matter who they are.",
    content:
      "This community is built on improving each other to get everyone better. Always be nice to other users in posts, comments, and direct messages. Personal attacks, harassment, and targeting other members are not tolerated.",
  },
  {
    slug: "keep-it-appropriate",
    title: "Keep it appropriate",
    description: "Posts and comments should stay suitable for the whole community.",
    content:
      "Keep all posts and comments appropriate for a shared community space. Avoid content that is overly graphic, explicit, or otherwise unsuitable for the entire community to see.",
  },
  {
    slug: "no-profanity",
    title: "No profanity or bad language",
    description: "Keep your language clean across posts, comments, and DMs.",
    content:
      "No profanity or bad language in direct messages, posts, or comments. Keep your language clean everywhere, even in private conversations — the standard doesn't change just because you're not in a public channel.",
  },
  {
    slug: "help-each-other",
    title: "Help each other improve",
    description: "The whole point of the community is getting everyone better.",
    content:
      "This community is built on improving each other to get everyone better. Share what you know, offer constructive feedback, and support other members who are learning. Encourage progress rather than tearing people down.",
  },
];

export function getRule(slug: string): Rule | undefined {
  return rules.find((rule) => rule.slug === slug);
}

export function searchRules(query: string, take = 10) {
  const q = query.toLowerCase();
  return rules
    .filter(
      (rule) =>
        rule.title.toLowerCase().includes(q) ||
        rule.description.toLowerCase().includes(q) ||
        rule.content.toLowerCase().includes(q)
    )
    .slice(0, take)
    .map((rule) => ({ id: rule.slug, title: rule.title, slug: rule.slug }));
}

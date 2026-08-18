export function extractHeadings(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  return lines
    .map((line) => {
      const match = line.match(/^(#{2,3})\s+(.*)/);
      if (!match) return null;
      const level = match[1].length;
      const text = match[2].trim();
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return { level, text, slug };
    })
    .filter(Boolean) as Array<{ level: number; text: string; slug: string }>;
}

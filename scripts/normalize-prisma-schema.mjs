import fs from "node:fs";

const path = "prisma/schema.prisma";
const source = fs.readFileSync(path, "utf8");
const typeNames = new Set([
  ...[...source.matchAll(/^(?:model|enum)\s+(\w+)/gm)].map((match) => match[1]),
  "String",
  "Int",
  "Float",
  "Boolean",
  "DateTime",
  "Json",
  "Decimal",
  "BigInt",
  "Bytes",
]);

function formatModel(_match, name, body) {
  const tokens = body.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = [];

  const flushField = () => {
    if (current.length) {
      lines.push(`  ${current.join(" ")}`);
      current = [];
    }
  };

  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];

    if (token.startsWith("@@")) {
      flushField();
      const directive = [token];
      i += 1;
      while (i < tokens.length && !tokens[i].startsWith("@@")) {
        directive.push(tokens[i]);
        i += 1;
      }
      lines.push(`  ${directive.join(" ")}`);
      continue;
    }

    const candidate = tokens[i + 1]?.replace(/\?$/, "").replace(/\[\]$/, "");
    const isField = /^[A-Za-z_]\w*$/.test(token) && candidate && typeNames.has(candidate);

    if (isField) {
      flushField();
      current = [token, tokens[i + 1]];
      i += 2;
      continue;
    }

    current.push(token);
    i += 1;
  }

  flushField();
  return `model ${name} {\n${lines.join("\n")}\n}`;
}

function formatEnum(_match, name, body) {
  const values = body.split(/\s+/).filter(Boolean);
  return `enum ${name} {\n${values.map((value) => `  ${value}`).join("\n")}\n}`;
}

const normalized = source
  .replace(/enum\s+(\w+)\s*\{([^{}\n]*)\}/g, formatEnum)
  .replace(/model\s+(\w+)\s*\{([^{}\n]*)\}/g, formatModel)
  .replace(/\n{3,}/g, "\n\n")
  .trim() + "\n";

const primaryKeys = new Map();
for (const match of normalized.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  const id = match[2].match(/^\s*id\s+(\w+)/m);
  if (id) primaryKeys.set(match[1], id[1]);
}

const repaired = normalized.replace(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g, (match, name, body) => {
  const declared = new Set([...body.matchAll(/^\s*(\w+)\s+[A-Za-z_]\w*(?:\[\])?\??/gm)].map((entry) => entry[1]));
  const missing = new Set();
  for (const relation of body.matchAll(/^\s*(\w+)\s+(\w+)\??\s+@relation\(([^)]*)\)/gm)) {
    const fields = relation[3].match(/fields:\s*\[([^\]]+)\]/)?.[1];
    if (!fields) continue;
    const scalarType = primaryKeys.get(relation[2]) ?? "String";
    for (const field of fields.split(",").map((value) => value.trim()).filter(Boolean)) {
      if (!declared.has(field)) missing.add(`${field} ${scalarType}`);
    }
  }
  if (!missing.size) return match;
  return `model ${name} {\n${[...missing].map((field) => `  ${field}`).join("\n")}\n${body.trim()}\n}`;
});

const finalSchema = repaired.trim() + "\n";
if (finalSchema !== source) fs.writeFileSync(path, finalSchema);

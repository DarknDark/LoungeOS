import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const zodIndex = path.join(root, "api-zod", "src", "index.ts");
const generatedFiles = [
  path.join(root, "api-zod", "src", "generated", "api.ts"),
  path.join(root, "api-client-react", "src", "generated", "api.ts"),
  path.join(root, "api-client-react", "src", "generated", "api.schemas.ts"),
];

const indexSource = await readFile(zodIndex, "utf8");
const normalizedIndex = indexSource
  .replace(/\r\n/g, "\n")
  .replace(/^export \* from ['"]\.\/generated\/types['"];\n?/m, "")
  .trimEnd() + "\n";
await writeFile(zodIndex, normalizedIndex);

for (const file of generatedFiles) {
  const source = await readFile(file, "utf8");
  await writeFile(file, source.replace(/\r\n/g, "\n").trimEnd() + "\n");
}
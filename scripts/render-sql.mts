import { mkdir, readFile, writeFile } from "node:fs/promises";
import { configFromJson } from "../src/core/config.js";
import { renderSqlTemplates } from "../src/sql/render.js";

function argument(name: string): string | undefined {
  const prefix = `${name}=`;
  const direct = process.argv.find(arg => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const configPath = argument("--config") ?? "avatar-profile.config.json";
const outputDir = argument("--out");
const raw = JSON.parse(await readFile(configPath, "utf8")) as unknown;
const config = configFromJson(raw);
const rendered = await renderSqlTemplates(config);

if (outputDir) {
  await mkdir(outputDir, { recursive: true });
  for (const [file, sql] of Object.entries(rendered)) {
    const target = `${outputDir}/${file.replace(/\.tpl$/, "")}`;
    await writeFile(target, sql, "utf8");
    console.log(`Escrito ${target}`);
  }
} else {
  for (const [file, sql] of Object.entries(rendered)) {
    console.log(`\n-- ${file.replace(/\.tpl$/, "")}\n${sql}`);
  }
}

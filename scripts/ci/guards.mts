import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { loadProject } from "@kitty-crow/code-guards/src/project.ts";
import {
  noNestedIf, typeReuse, functionQuality, moduleCohesion, codeHealth,
  crossModule, documentation, repoHygiene, enterpriseLookingNaming, reviewPractices,
} from "@kitty-crow/code-guards/src/guards/index.ts";
import { renderFindings } from "@kitty-crow/code-guards/src/diagnostics.ts";
import { failed, resolveExpectations, type Finding } from "@kitty-crow/code-guards/src/model.ts";

const root = process.argv[2] ?? "";
if (!root) throw new Error("missing isolated guard workspace");

const owned = new Set(readFileSync(join(root, ".guard-files"), "utf8").split("\0"));
const project = loadProject(join(root, "tsconfig.guards.json"));
project.files = project.files.filter(file => owned.has(relative(root, file.fileName).replaceAll("\\", "/")));

if (project.files.length === 0) throw new Error("guard scope contains no source files");

const checked = async (name: string, run: () => Finding[] | Promise<Finding[]>): Promise<Finding[]> => {
  console.error(`Code Guards: ${name}`);
  const result = await run();
  console.error(`Code Guards: ${name} completed (${result.length} findings before checked expectations)`);
  return result;
};

// Run the pinned engine's complete suite against owned files. The checker
// still resolves upstream types, but dependency files are not visited.
const findings = resolveExpectations(project.root, project.files, [
  ...noNestedIf(project),
  ...await checked("type reuse", () => typeReuse(project, true)),
  ...await checked("function quality", () => functionQuality(project, true)),
  ...await checked("module cohesion", () => moduleCohesion(project, true)),
  ...codeHealth(project, true),
  ...crossModule(project),
  ...await checked("documentation", () => documentation(project)),
  ...repoHygiene(project.root),
  ...enterpriseLookingNaming(project, true),
  ...reviewPractices(project, true),
]);

console.error("Repository-owned TypeScript files: " + project.files.length);
console.log(renderFindings(findings, { format: "json", colour: "never", root: project.root }));
process.exitCode = failed(findings, true) ? 1 : 0;

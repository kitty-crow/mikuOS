import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { loadProject } from "../../code-guards/src/project.ts";
import {
  noNestedIf, typeReuse, functionQuality, moduleCohesion, codeHealth,
  crossModule, documentation, repoHygiene, enterpriseLookingNaming, reviewPractices,
} from "../../code-guards/src/guards/index.ts";
import { renderFindings } from "../../code-guards/src/diagnostics.ts";

const root = process.argv[2] ?? "";
if (!root) throw new Error("missing isolated guard workspace");

const owned = new Set(readFileSync(join(root, ".guard-files"), "utf8").split("\0"));
const project = loadProject(join(root, "tsconfig.guards.json"));
project.files = project.files.filter(file => owned.has(relative(root, file.fileName).replaceAll("\\", "/")));

if (project.files.length === 0) throw new Error("guard scope contains no source files");

// Run the pinned engine's complete suite against owned files. The checker
// still resolves upstream types, but dependency files are not visited.
const findings = [
  ...noNestedIf(project),
  ...await typeReuse(project, true),
  ...await functionQuality(project, true),
  ...await moduleCohesion(project, true),
  ...codeHealth(project, true),
  ...crossModule(project),
  ...await documentation(project),
  ...repoHygiene(project.root),
  ...enterpriseLookingNaming(project, true),
  ...reviewPractices(project, true),
];

console.error("Repository-owned TypeScript files: " + project.files.length);
console.log(renderFindings(findings, { format: "json", colour: "never", root: project.root }));
process.exitCode = findings.some(finding => finding.severity === "warning") ? 1 : 0;

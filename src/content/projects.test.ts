import { test } from "node:test";
import assert from "node:assert/strict";
import { projects, archiveProjects, projectCounter } from "./projects.ts";
import { SEALS } from "../components/archive/layout.ts";

test("THE ARCHIVE holds exactly one project per seal", () => {
  assert.equal(archiveProjects.length, SEALS.length, "a project beyond the seals must say archive: false");
  for (const s of SEALS) assert.ok(archiveProjects[s.project], `seal ${s.project} has a project`);
});

test("the Works counter is counted from the list", () => {
  const total = String(projects.length).padStart(2, "0");
  projects.forEach((p, i) => assert.equal(projectCounter(p), `${String(i + 1).padStart(2, "0")} / ${total}`));
});

test("slugs are unique", () => {
  assert.equal(new Set(projects.map((p) => p.slug)).size, projects.length);
});

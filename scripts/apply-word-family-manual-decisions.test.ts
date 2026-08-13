import { describe, expect, test } from "bun:test";
import { rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("approved word-family manual decisions", () => {
  test("has a deterministic dry run and leaves production data unchanged", async () => {
    const output = resolve(".scratch/word-family-manual-decisions-test");
    rmSync(output, { recursive: true, force: true });
    const beforeCsv = await Bun.file("data/curio_gaokao_vocabulary.csv").text();
    const beforeDb = Bun.hash(await Bun.file("data/curio.db").arrayBuffer());
    const process = Bun.spawn(["bun", "scripts/apply-word-family-manual-decisions.ts", "--dry-run", "--audit-dir", output], { stdout: "pipe", stderr: "pipe" });
    const exitCode = await process.exited;
    const stderr = await new Response(process.stderr).text();
    expect(exitCode, stderr).toBe(0);
    const manifestPath = Bun.file(resolve(output, "manifest.json")).size > 0 ? "manifest.json" : "verification.json";
    const manifest = JSON.parse(readFileSync(resolve(output, manifestPath), "utf8"));
    expect(manifest.result).toMatchObject({ nonempty_heads: 174, members: 180 });
    expect(manifest.scope).toMatchObject({ auto_fill_candidates_untouched: 118, rejected_decisions_no_change: 2 });
    if (manifestPath === "manifest.json") {
      const diff = JSON.parse(readFileSync(resolve(output, "dry-run-diff.json"), "utf8"));
      expect(diff.some((row: { word: string }) => row.word === "tire")).toBe(true);
      expect(diff.some((row: { word: string }) => row.word === "tired")).toBe(true);
    }
    expect(await Bun.file("data/curio_gaokao_vocabulary.csv").text()).toBe(beforeCsv);
    expect(Bun.hash(await Bun.file("data/curio.db").arrayBuffer())).toBe(beforeDb);
  });
});

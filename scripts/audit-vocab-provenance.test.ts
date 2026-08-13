import { describe, expect, test } from "bun:test";
import { rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vocabulary provenance audit", () => {
  test("reproduces the fixed P0-B audit without mutating product data", async () => {
    const output = resolve(".scratch/vocab-p0b-audit-test");
    rmSync(output, { recursive: true, force: true });
    const beforeCsv = Bun.hash(await Bun.file("data/curio_gaokao_vocabulary.csv").arrayBuffer());
    const beforeDb = Bun.hash(await Bun.file("data/curio.db").arrayBuffer());
    const process = Bun.spawn([
      "bun", "scripts/audit-vocab-provenance.ts", "--output", output,
    ], { stdout: "pipe", stderr: "pipe" });
    const exitCode = await process.exited;
    const stderr = await new Response(process.stderr).text();
    expect(exitCode, stderr).toBe(0);
    const summary = JSON.parse(readFileSync(resolve(output, "summary.json"), "utf8"));
    expect(summary.status).toBe("PASS_WITH_DISCLOSED_LIMITATIONS");
    expect(summary.product_rows).toBe(3500);
    expect(summary.conflicts.total).toBe(0);
    expect(summary.word_family.current_nonempty).toBe(174);
    expect(summary.word_family.current_members).toBe(180);
    expect(summary.controlled_update_applies).toBe(true);
    expect(summary.ecdict_actual_use.pos_selected_rows).toBe(3296);
    expect(Bun.hash(await Bun.file("data/curio_gaokao_vocabulary.csv").arrayBuffer())).toBe(beforeCsv);
    expect(Bun.hash(await Bun.file("data/curio.db").arrayBuffer())).toBe(beforeDb);
  });
});

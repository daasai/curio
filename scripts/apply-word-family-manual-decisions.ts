import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Row = Record<string, string>;
const BASELINE_SHA256 = "60d4b0201abd7a72787d0be12b45bc88edfc3ee6335563e4c2d7bbe4f650d022";
const DEFAULT_AUDIT_DIR = "data/audits/vocab-p0b/controlled-updates/2026-08-13-word-family-manual-review";
const HEADERS = ["word", "phonetic", "pos", "meaning_cn", "level", "gaokao_frequency", "word_family", "tags"];
const DECISION_COUNTS: Record<string, number> = {
  DELETE_RELATION: 14, KEEP_RELATION: 2, REPLACE_RELATION: 1, ADD_RELATION: 5,
  FIX_FIELDS_AND_ADD: 1, REJECT_CANDIDATE: 2,
};

function sha256(path: string) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function parseCsv(text: string) {
  const records: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) { if (char === '"' && text[index + 1] === '"') { value += char; index += 1; } else if (char === '"') quoted = false; else value += char; }
    else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); records.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, "")); records.push(row); }
  const headers = records.shift() || [];
  return { headers, rows: records.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))) };
}
function csv(value: string) { return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }
function serialize(rows: Row[], lineEnding: "\n" | "\r\n") { return `${[HEADERS.join(","), ...rows.map((row) => HEADERS.map((header) => csv(row[header] || "")).join(","))].join(lineEnding)}${lineEnding}`; }
function family(row: Row) { return row.word_family.split(",").map((word) => word.trim().toLowerCase()).filter(Boolean); }
function setFamily(row: Row, members: string[]) { row.word_family = [...new Set(members.filter((word) => word && word !== row.word))].sort().join(","); }
function usage() { throw new Error("Usage: bun scripts/apply-word-family-manual-decisions.ts [--dry-run] [--audit-dir PATH]"); }

function args(argv: string[]) {
  let dryRun = false; let auditDir = DEFAULT_AUDIT_DIR;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--audit-dir") auditDir = argv[++i] || usage();
    else usage();
  }
  return { dryRun, auditDir: resolve(auditDir) };
}

function assertBaseline(csvPath: string, dbPath: string, rows: Row[]) {
  if (rows.length !== 3500 || new Set(rows.map((row) => row.word)).size !== 3500) throw new Error("CSV baseline is not the expected 3500 unique-headword vocabulary.");
  const db = new Database(dbPath, { readonly: true });
  const dbRows = db.query("SELECT word, phonetic, pos, meaning_cn, CAST(level AS TEXT) level, gaokao_frequency, COALESCE(word_family, '') word_family, COALESCE(tags, '') tags FROM vocab_library").all() as Row[];
  db.close();
  if (dbRows.length !== rows.length) throw new Error(`SQLite drift: expected ${rows.length} vocabulary rows, got ${dbRows.length}.`);
  const byWord = new Map(dbRows.map((row) => [row.word, row]));
  for (const row of rows) for (const header of HEADERS) if ((byWord.get(row.word)?.[header] || "") !== (row[header] || "")) throw new Error(`SQLite drift for ${row.word}.${header}.`);
}

function validateDecisions(decisions: Row[]) {
  if (decisions.length !== 25 || new Set(decisions.map((row) => row.relation_id)).size !== 25) throw new Error("Decision source must contain exactly 25 unique relationship decisions.");
  for (const [decision, count] of Object.entries(DECISION_COUNTS)) if (decisions.filter((row) => row.decision === decision).length !== count) throw new Error(`Decision count mismatch for ${decision}.`);
  if (decisions.some((row) => row.review_status !== "approved_for_implementation" || row.bidirectional !== "true")) throw new Error("Every decision must be approved and bidirectional.");
}

function main() {
  const { dryRun, auditDir } = args(process.argv.slice(2));
  const root = resolve("."); const csvPath = resolve(root, "data/curio_gaokao_vocabulary.csv"); const dbPath = resolve(root, "data/curio.db");
  const decisionPath = resolve(root, "data/audits/vocab-p0b/review/word-family-manual-decisions.csv");
  const lockPath = resolve(root, "data/audits/vocab-p0b/source-lock.json");
  const csvText = readFileSync(csvPath, "utf8"); const parsed = parseCsv(csvText);
  if (parsed.headers.join("|") !== HEADERS.join("|")) throw new Error("Unexpected product CSV schema.");
  const currentCsvHash = sha256(csvPath);
  const sourceLock = JSON.parse(readFileSync(lockPath, "utf8"));
  const appliedUpdate = (sourceLock.controlled_updates || []).find((update: { current_csv_sha256?: string }) => update.current_csv_sha256 === currentCsvHash);
  if (currentCsvHash !== BASELINE_SHA256 && !appliedUpdate) throw new Error("CSV drift: neither the P0-B historical baseline nor this controlled update's pinned version is present.");
  assertBaseline(csvPath, dbPath, parsed.rows);
  const decisions = parseCsv(readFileSync(decisionPath, "utf8")).rows; validateDecisions(decisions);
  if (appliedUpdate) {
    const current = { nonempty_heads: parsed.rows.filter((row) => row.word_family).length, members: parsed.rows.reduce((n, row) => n + family(row).length, 0) };
    if (current.nonempty_heads !== 174 || current.members !== 180) throw new Error("Pinned controlled update has unexpected word-family statistics.");
    const manifest = { update_id: "P0-B-WFMR-2026-08-13", mode: "already-applied-verification", decision_source: { path: "data/audits/vocab-p0b/review/word-family-manual-decisions.csv", sha256: sha256(decisionPath), decisions: decisions.length }, result: { csv_sha256: currentCsvHash, ...current }, scope: { auto_fill_candidates_untouched: 118, rejected_decisions_no_change: 2 } };
    mkdirSync(auditDir, { recursive: true }); writeFileSync(resolve(auditDir, "verification.json"), `${JSON.stringify(manifest, null, 2)}\n`); console.log(JSON.stringify(manifest, null, 2)); return;
  }
  const rows = parsed.rows.map((row) => ({ ...row })); const byWord = new Map(rows.map((row) => [row.word, row]));
  const get = (word: string) => { const row = byWord.get(word); if (!row) throw new Error(`Decision references a non-vocabulary word: ${word}`); return row; };
  const removePair = (left: string, right: string) => { const a = get(left), b = get(right); if (!family(a).includes(right) || !family(b).includes(left)) throw new Error(`Expected existing reciprocal relation missing: ${left}/${right}`); setFamily(a, family(a).filter((word) => word !== right)); setFamily(b, family(b).filter((word) => word !== left)); };
  const addPair = (left: string, right: string) => { const a = get(left), b = get(right); if (left === right) throw new Error("Self family relation is forbidden."); setFamily(a, [...family(a), right]); setFamily(b, [...family(b), left]); };
  for (const decision of decisions) {
    const left = decision.headword, right = decision.related_word;
    if (decision.decision === "DELETE_RELATION") removePair(left, right);
    if (decision.decision === "KEEP_RELATION") { if (!family(get(left)).includes(right) || !family(get(right)).includes(left)) throw new Error(`Approved KEEP relation is not reciprocal: ${left}/${right}`); }
    if (decision.decision === "REPLACE_RELATION") { removePair(left, right); addPair(decision.replacement_headword, decision.replacement_related_word); }
    if (decision.decision === "ADD_RELATION") addPair(left, right);
    if (decision.decision === "FIX_FIELDS_AND_ADD") { const a = get(left), b = get(right); a.pos = decision.headword_pos_after; a.meaning_cn = decision.headword_meaning_after; b.pos = decision.related_pos_after; b.meaning_cn = decision.related_meaning_after; addPair(left, right); }
  }
  for (const row of rows) { const members = family(row); if (members.length !== new Set(members).size || members.includes(row.word) || members.some((member) => !byWord.has(member))) throw new Error(`Invalid word family generated for ${row.word}.`); for (const member of members) if (!family(get(member)).includes(row.word)) throw new Error(`Non-reciprocal word family generated for ${row.word}/${member}.`); }
  const changed = rows.filter((row, index) => HEADERS.some((header) => row[header] !== parsed.rows[index][header]));
  const approvedWords = new Set(decisions.flatMap((decision) => [decision.headword, decision.related_word, decision.replacement_headword, decision.replacement_related_word]).filter(Boolean));
  if (changed.some((row) => !approvedWords.has(row.word))) throw new Error("Generated change exceeds the approved word scope.");
  const diff = changed.map((row) => ({ word: row.word, before_word_family: parsed.rows.find((item) => item.word === row.word)?.word_family || "", after_word_family: row.word_family, before_pos: parsed.rows.find((item) => item.word === row.word)?.pos || "", after_pos: row.pos, before_meaning_cn: parsed.rows.find((item) => item.word === row.word)?.meaning_cn || "", after_meaning_cn: row.meaning_cn }));
  const before = { nonempty_heads: parsed.rows.filter((row) => row.word_family).length, members: parsed.rows.reduce((n, row) => n + family(row).length, 0) };
  const after = { nonempty_heads: rows.filter((row) => row.word_family).length, members: rows.reduce((n, row) => n + family(row).length, 0) };
  if (after.nonempty_heads !== 174 || after.members !== 180) throw new Error(`Unexpected resulting statistics: ${after.nonempty_heads} heads, ${after.members} members.`);
  const nextCsv = serialize(rows, csvText.includes("\r\n") ? "\r\n" : "\n"); const nextHash = createHash("sha256").update(nextCsv).digest("hex");
  const manifest = { update_id: "P0-B-WFMR-2026-08-13", mode: dryRun ? "dry-run" : "apply", decision_source: { path: "data/audits/vocab-p0b/review/word-family-manual-decisions.csv", sha256: sha256(decisionPath), decisions: decisions.length }, baseline: { csv_sha256: BASELINE_SHA256, db_sha256: sha256(dbPath), nonempty_heads: before.nonempty_heads, members: before.members }, result: { csv_sha256: nextHash, nonempty_heads: after.nonempty_heads, members: after.members, changed_words: diff.length }, scope: { approved_words: [...approvedWords].sort(), auto_fill_candidates_untouched: 118, rejected_decisions_no_change: 2 }, rollback: { csv: "restore before/curio_gaokao_vocabulary.csv, then run npm run db:seed", database: "restore before/curio.db only if rollback is required; it may contain local business data and remains local-only" } };
  mkdirSync(auditDir, { recursive: true }); mkdirSync(resolve(auditDir, "before"), { recursive: true });
  writeFileSync(resolve(auditDir, "dry-run-diff.json"), `${JSON.stringify(diff, null, 2)}\n`);
  writeFileSync(resolve(auditDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (dryRun) { console.log(JSON.stringify(manifest, null, 2)); return; }
  if (existsSync(resolve(auditDir, "before/curio_gaokao_vocabulary.csv"))) throw new Error("Refusing to overwrite an existing controlled-update backup.");
  copyFileSync(csvPath, resolve(auditDir, "before/curio_gaokao_vocabulary.csv"));
  copyFileSync(dbPath, resolve(auditDir, "before/curio.db"));
  writeFileSync(csvPath, nextCsv);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.historical_product_baseline = { sha256: BASELINE_SHA256, note: "P0-B formal audit baseline; retained unchanged after controlled update." };
  lock.controlled_updates = [{ update_id: manifest.update_id, decision_csv_sha256: manifest.decision_source.sha256, baseline_csv_sha256: BASELINE_SHA256, current_csv_sha256: nextHash, audit_manifest: "data/audits/vocab-p0b/controlled-updates/2026-08-13-word-family-manual-review/manifest.json", scope: "25 approved relationship decisions only; 118 auto_fill_candidate items untouched" }];
  lock.product_sha256 = nextHash;
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(resolve(auditDir, "README.md"), "# P0-B controlled word-family update\n\nThis directory contains the local-only pre-update CSV and SQLite backup, deterministic dry-run diff, decision hash, and manifest. The SQLite backup can contain local business data; do not distribute it. Roll back by restoring `before/curio_gaokao_vocabulary.csv`, then run `npm run db:seed`; restore `before/curio.db` only when a full local database rollback is required.\n");
  console.log(JSON.stringify(manifest, null, 2));
}

main();

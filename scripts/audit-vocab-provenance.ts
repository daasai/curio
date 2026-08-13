import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PRODUCT_FIELDS = [
  "phonetic",
  "pos",
  "meaning_cn",
  "level",
  "gaokao_frequency",
  "word_family",
  "tags",
] as const;
type ProductField = (typeof PRODUCT_FIELDS)[number];
type CsvRow = Record<string, string>;

const EXPECTED_HEADERS = ["word", ...PRODUCT_FIELDS];
const HISTORICAL_PRODUCT_SHA256 = "60d4b0201abd7a72787d0be12b45bc88edfc3ee6335563e4c2d7bbe4f650d022";
const ALLOWED_POS = new Set(["n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "num.", "interj."]);
const ALLOWED_TAGS = new Set([
  "emotion", "character", "action", "description", "reasoning", "social",
  "nature", "science", "education", "economy", "culture", "mystery",
]);
const PLACEHOLDER_RE = /^(?:n\/?a|na|n\.a\.|none|null|unknown|todo|tbd|#value!|-+|\?+|待补|暂无|未知)$/i;
const ECDICT_FORM_CODES = new Set(["0", "p", "d", "i", "3", "s", "r", "t"]);

const TAG_KEYWORDS: Record<string, string[]> = {
  emotion: ["情绪", "感到", "快乐", "悲伤", "害怕", "焦虑", "愤怒", "喜爱", "感激", "乐观", "态度"],
  character: ["勇敢", "诚实", "勤奋", "耐心", "忠诚", "宽容", "谦虚", "坚强", "自私", "无私", "性格", "品质"],
  reasoning: ["推断", "推论", "分析", "判断", "假设", "证明", "结论", "逻辑", "辨别", "比较"],
  social: ["合作", "竞争", "交流", "沟通", "社会", "关系", "影响", "帮助", "支持"],
  nature: ["自然", "气候", "环境", "动物", "植物", "海洋", "山", "河", "天气", "生态"],
  science: ["科学", "技术", "实验", "研究", "数据", "物理", "化学", "生物", "机器", "计算机"],
  education: ["教育", "学习", "学校", "学生", "教师", "课程", "知识", "考试", "阅读", "写作"],
  economy: ["经济", "商业", "市场", "价格", "贸易", "资源", "公司", "银行", "货币", "消费"],
  culture: ["文化", "艺术", "传统", "习俗", "音乐", "绘画", "文学", "历史", "创作", "语言"],
  mystery: ["隐藏", "秘密", "线索", "调查", "神秘", "谜", "犯罪", "嫌疑", "揭露"],
};

const TAG_OVERRIDES: Record<string, string> = {
  ambiguous: "reasoning", deduce: "reasoning", resilient: "character,emotion",
  conceal: "action,mystery", persist: "character,action", advocate: "social,action",
  persevere: "character", elaborate: "description,action", obscure: "description,reasoning",
  tentative: "reasoning,description", indifferent: "emotion", intricate: "description",
  subtle: "description,reasoning", discern: "reasoning", exemplify: "reasoning",
  ephemeral: "description", ubiquitous: "description", nonchalant: "emotion",
};

const LEVEL_OVERRIDES: Record<string, number> = Object.fromEntries([
  ...["ambiguous", "deduce", "resilient", "conceal", "persist", "advocate", "persevere"].map((word) => [word, 1]),
  ...["elaborate", "obscure", "tentative", "indifferent"].map((word) => [word, 2]),
  ...["intricate", "subtle", "discern", "exemplify"].map((word) => [word, 3]),
  ...["ephemeral", "ubiquitous", "nonchalant"].map((word) => [word, 4]),
]);

// Surface-form pairs that the historical prefix/suffix heuristic emitted but
// that cannot safely be treated as learner-facing families without a lexical review.
const FAMILY_REVIEW_PAIRS = new Set([
  "apart|apartment", "bare|barely", "base|basement", "count|discount",
  "cover|discover", "disease|ease", "dismiss|miss", "display|play",
  "hard|hardly", "late|lately", "less|unless", "like|likely",
  "live|lively", "most|mostly", "near|nearly", "short|shortly",
]);

function parseArgs(argv: string[]) {
  const values: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "snapshot-inputs") values[key] = true;
    else values[key] = argv[++index];
  }
  const root = resolve(String(values.root || "."));
  const inputDir = resolve(root, String(values["input-dir"] || "data/audits/vocab-p0b/input"));
  return {
    root,
    csv: resolve(root, String(values.csv || "data/curio_gaokao_vocabulary.csv")),
    db: resolve(root, String(values.db || "data/curio.db")),
    evidence: resolve(root, String(values.evidence || `${inputDir}/curio_gaokao_vocabulary_evidence.csv`)),
    sources: resolve(root, String(values.sources || `${inputDir}/SOURCES.json`)),
    ecdict: values.ecdict ? resolve(root, String(values.ecdict)) : "",
    ecdictIndex: resolve(root, String(values["ecdict-index"] || `${inputDir}/ecdict-selected-fields.csv`)),
    sourceLock: resolve(root, String(values["source-lock"] || "data/audits/vocab-p0b/source-lock.json")),
    output: resolve(root, String(values.output || "data/audits/vocab-p0b/result")),
    inputDir,
    snapshotInputs: Boolean(values["snapshot-inputs"]),
  };
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      records.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    records.push(row);
  }
  const headers = records.shift() || [];
  return {
    headers,
    rows: records.filter((values) => values.some(Boolean)).map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
    ),
  };
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(path: string, headers: string[], rows: Record<string, unknown>[]) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function inferFamily(word: string, vocabulary: Set<string>): string[] {
  const suffixes = ["ly", "ness", "ment", "ful", "less"];
  const prefixes = ["un", "dis"];
  const candidates: Array<[number, string]> = [];
  for (const other of vocabulary) {
    if (other === word || other.includes(" ")) continue;
    let related = false;
    for (const suffix of suffixes) {
      if (word.length >= 4 && other.startsWith(word) && other.slice(word.length) === suffix) related = true;
      if (other.length >= 4 && word.startsWith(other) && word.slice(other.length) === suffix) related = true;
    }
    for (const prefix of prefixes) {
      if ((word.length >= 4 && other === prefix + word) || (other.length >= 4 && word === prefix + other)) related = true;
    }
    if (related) candidates.push([Math.abs(other.length - word.length), other]);
  }
  return candidates.sort((left, right) => left[0] - right[0] || left[1].localeCompare(right[1])).slice(0, 4).map((item) => item[1]);
}

function assignTags(row: CsvRow): string {
  if (TAG_OVERRIDES[row.word]) return TAG_OVERRIDES[row.word];
  const matches = Object.entries(TAG_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => row.meaning_cn.includes(keyword)))
    .map(([tag]) => tag);
  if (matches.length) return matches.slice(0, 2).join(",");
  return row.pos.includes("v.") ? "action" : "description";
}

function parseExchange(value: string, vocabulary: Set<string>): Array<{ code: string; word: string }> {
  const seen = new Set<string>();
  const result: Array<{ code: string; word: string }> = [];
  for (const part of value.split("/")) {
    const separator = part.indexOf(":");
    if (separator < 0) continue;
    const code = part.slice(0, separator).trim();
    const word = part.slice(separator + 1).trim().toLowerCase();
    const key = `${code}:${word}`;
    if (!ECDICT_FORM_CODES.has(code) || !vocabulary.has(word) || seen.has(key)) continue;
    seen.add(key);
    result.push({ code, word });
  }
  return result;
}

function snapshotEcdict(rawPath: string, targetPath: string, vocabulary: Set<string>) {
  const parsed = parseCsv(readFileSync(rawPath, "utf8"));
  const selected = new Map<string, CsvRow>();
  for (const row of parsed.rows) {
    const word = row.word?.trim().toLowerCase();
    if (!vocabulary.has(word) || selected.has(word)) continue;
    selected.set(word, {
      word,
      pos: row.pos || "",
      translation: row.translation || "",
      tag: row.tag || "",
      bnc: row.bnc || "0",
      frq: row.frq || "0",
      exchange: row.exchange || "",
    });
  }
  writeCsv(targetPath, ["word", "pos", "translation", "tag", "bnc", "frq", "exchange"], [...selected.values()]);
}

function reproduceLevels(rows: CsvRow[], evidenceByWord: Map<string, CsvRow>, ecdictByWord: Map<string, CsvRow>) {
  const weight: Record<string, number> = { junior: 0, required: 1, selective_required: 2, extension: 3 };
  const ranked = [...rows].sort((a, b) => {
    const ae = evidenceByWord.get(a.word) || {};
    const be = evidenceByWord.get(b.word) || {};
    const ad = ecdictByWord.get(a.word) || {};
    const bd = ecdictByWord.get(b.word) || {};
    const aranks = [Number(ad.bnc || 0), Number(ad.frq || 0)].filter((value) => value > 0);
    const branks = [Number(bd.bnc || 0), Number(bd.frq || 0)].filter((value) => value > 0);
    const arank = aranks.length ? Math.min(...aranks) : 1e9;
    const brank = branks.length ? Math.min(...branks) : 1e9;
    return Number(be.paper_hits || 0) - Number(ae.paper_hits || 0)
      || arank - brank
      || (weight[ae.official_level] ?? 3) - (weight[be.official_level] ?? 3)
      || a.word.length - b.word.length
      || a.word.localeCompare(b.word);
  });
  const levels = new Map<string, number>();
  const quotas: Array<[number, number]> = [[1, 800], [2, 800], [3, 900], [4, 1000]];
  let cursor = 0;
  for (const [level, count] of quotas) {
    for (const row of ranked.slice(cursor, cursor + count)) levels.set(row.word, level);
    cursor += count;
  }
  const protectedWords = new Set(Object.keys(LEVEL_OVERRIDES));
  for (const [word, target] of Object.entries(LEVEL_OVERRIDES)) {
    const current = levels.get(word);
    if (!current || current === target) continue;
    const eligible = rows.filter((row) => !protectedWords.has(row.word) && levels.get(row.word) === target);
    eligible.sort((a, b) => {
      const ae = evidenceByWord.get(a.word) || {};
      const be = evidenceByWord.get(b.word) || {};
      const ad = ecdictByWord.get(a.word) || {};
      const bd = ecdictByWord.get(b.word) || {};
      const aranks = [Number(ad.bnc || 0), Number(ad.frq || 0)].filter((value) => value > 0);
      const branks = [Number(bd.bnc || 0), Number(bd.frq || 0)].filter((value) => value > 0);
      const arank = aranks.length ? Math.min(...aranks) : 1e9;
      const brank = branks.length ? Math.min(...branks) : 1e9;
      const aExtension = ae.official_level === "extension" ? 1 : 0;
      const bExtension = be.official_level === "extension" ? 1 : 0;
      return Number(ae.paper_hits || 0) - Number(be.paper_hits || 0)
        || brank - arank
        || bExtension - aExtension
        || b.word.length - a.word.length
        || b.word.localeCompare(a.word);
    });
    const swap = eligible[0];
    if (swap) {
      levels.set(word, target);
      levels.set(swap.word, current);
    }
  }
  return levels;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const product = parseCsv(readFileSync(args.csv, "utf8"));
  if (product.headers.join("|") !== EXPECTED_HEADERS.join("|")) {
    throw new Error(`Unexpected product headers: ${product.headers.join(",")}`);
  }
  const vocabulary = new Set(product.rows.map((row) => row.word.toLowerCase()));

  if (args.snapshotInputs) {
    mkdirSync(args.inputDir, { recursive: true });
    const evidence = parseCsv(readFileSync(args.evidence, "utf8"));
    writeCsv(resolve(args.inputDir, "curio_gaokao_vocabulary_evidence.csv"), evidence.headers, evidence.rows);
    const sources = JSON.parse(readFileSync(args.sources, "utf8"));
    writeFileSync(resolve(args.inputDir, "SOURCES.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8");
    if (!args.ecdict) throw new Error("--snapshot-inputs requires --ecdict");
    snapshotEcdict(args.ecdict, resolve(args.inputDir, "ecdict-selected-fields.csv"), vocabulary);
    args.evidence = resolve(args.inputDir, "curio_gaokao_vocabulary_evidence.csv");
    args.sources = resolve(args.inputDir, "SOURCES.json");
    args.ecdictIndex = resolve(args.inputDir, "ecdict-selected-fields.csv");
  }

  const evidence = parseCsv(readFileSync(args.evidence, "utf8"));
  const evidenceByWord = new Map(evidence.rows.map((row) => [row.word.toLowerCase(), row]));
  const ecdict = parseCsv(readFileSync(args.ecdictIndex, "utf8"));
  const ecdictByWord = new Map(ecdict.rows.map((row) => [row.word.toLowerCase(), row]));
  const sourceLock = JSON.parse(readFileSync(args.sourceLock, "utf8"));
  const sourceManifest = JSON.parse(readFileSync(args.sources, "utf8"));
  const expectedProductHash = sourceLock.product_sha256;
  if (typeof expectedProductHash !== "string") throw new Error("source-lock.json must pin the current product CSV hash.");
  const controlledUpdate = (sourceLock.controlled_updates || []).find((update: { current_csv_sha256?: string }) => update.current_csv_sha256 === expectedProductHash);
  const approvedDecisionWords = new Set(
    parseCsv(readFileSync(resolve(args.root, "data/audits/vocab-p0b/review/word-family-manual-decisions.csv"), "utf8")).rows
      .filter((row) => row.review_status === "approved_for_implementation")
      .flatMap((row) => [row.headword, row.related_word, row.replacement_headword, row.replacement_related_word])
      .filter(Boolean),
  );

  const db = new Database(args.db, { readonly: true });
  const dbRows = db.query(`
    SELECT word, phonetic, pos, meaning_cn, CAST(level AS TEXT) level,
           gaokao_frequency, COALESCE(word_family, '') word_family, COALESCE(tags, '') tags
    FROM vocab_library
  `).all() as CsvRow[];
  db.close();
  const dbByWord = new Map(dbRows.map((row) => [row.word.toLowerCase(), Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")]))]));

  const findings: Record<string, unknown>[] = [];
  const conflicts: Record<string, unknown>[] = [];
  const provenance: Record<string, unknown>[] = [];
  const familyRows: Record<string, unknown>[] = [];
  const fieldStats = Object.fromEntries(PRODUCT_FIELDS.map((field) => [field, {
    field, nonempty: 0, empty: 0, format_anomalies: 0, placeholders: 0,
    csv_db_conflicts: 0, trace_confirmed: 0, trace_partial: 0, trace_unavailable: 0,
  }])) as Record<ProductField, Record<string, number | string>>;

  const reproducedLevels = reproduceLevels(product.rows, evidenceByWord, ecdictByWord);
  const productHash = sha256(args.csv);
  const evidenceApplies = productHash === HISTORICAL_PRODUCT_SHA256
    && evidence.rows.length === product.rows.length
    && evidenceByWord.size === vocabulary.size;
  const currentVersionIsControlledUpdate = Boolean(controlledUpdate) && productHash === expectedProductHash;

  const exchangeByWord = new Map<string, Array<{ code: string; word: string }>>();
  for (const word of vocabulary) exchangeByWord.set(word, parseExchange(ecdictByWord.get(word)?.exchange || "", vocabulary).filter((item) => item.word !== word));

  for (const row of product.rows) {
    const word = row.word.toLowerCase();
    const dbRow = dbByWord.get(word);
    const evidenceRow = evidenceByWord.get(word);
    const inferredFamily = inferFamily(word, vocabulary);
    const actualFamily = splitList(row.word_family);
    const familyPairs = actualFamily.map((member) => [word, member].sort().join("|"));
    const ecdictCandidates = exchangeByWord.get(word) || [];
    const reciprocalCandidates = ecdictCandidates.filter((candidate) =>
      (exchangeByWord.get(candidate.word) || []).some((reverse) => reverse.word === word),
    );
    let familyClass = "should_not_fill";
    let familyReason = "no_current_value_or_fixed_source_candidate";
    let familyCandidates = "";
    if (actualFamily.length) {
      if (familyPairs.some((pair) => FAMILY_REVIEW_PAIRS.has(pair))) {
        familyClass = "manual_review";
        familyReason = "surface_affix_relation_has_known_semantic_or_homograph_risk";
      } else if (actualFamily.join(",") === inferredFamily.join(",")) {
        familyClass = "reliable_value";
        familyReason = "matches_fixed_conservative_affix_policy_and_members_exist";
      } else {
        familyClass = "manual_review";
        familyReason = "does_not_match_recorded_generation_policy";
      }
      familyCandidates = actualFamily.join(",");
    } else if (reciprocalCandidates.length) {
      familyClass = "auto_fill_candidate";
      familyReason = "ECDICT_exchange_has_reciprocal_in_vocabulary_candidate_candidate_only_no_write";
      familyCandidates = reciprocalCandidates.map((item) => `${item.code}:${item.word}`).join(",");
    } else if (ecdictCandidates.length) {
      familyClass = "manual_review";
      familyReason = "ECDICT_exchange_candidate_is_one_way_or_ambiguous";
      familyCandidates = ecdictCandidates.map((item) => `${item.code}:${item.word}`).join(",");
    }
    familyRows.push({ word, current_value: row.word_family, classification: familyClass, candidates: familyCandidates, reason: familyReason });

    for (const field of PRODUCT_FIELDS) {
      const value = row[field] ?? "";
      const stat = fieldStats[field];
      if (value.trim()) stat.nonempty = Number(stat.nonempty) + 1;
      else stat.empty = Number(stat.empty) + 1;
      let anomaly = "";
      if (field === "phonetic" && (!value.startsWith("/") || !value.endsWith("/") || value.length < 3)) anomaly = "invalid_slash_wrapped_phonetic";
      if (field === "pos" && splitList(value.replaceAll("/", ",")).some((part) => !ALLOWED_POS.has(part))) anomaly = "unsupported_pos";
      // A reviewed multi-part gloss such as tire's noun and verb senses may have
      // three clauses; longer lists remain outside this compact card contract.
      if (field === "meaning_cn" && (!/[\u3400-\u9fff]/.test(value) || value.split("；").length > 3)) anomaly = "invalid_chinese_meaning";
      if (field === "level" && !["1", "2", "3", "4"].includes(value)) anomaly = "invalid_level";
      if (field === "gaokao_frequency" && !["high", "medium", "low"].includes(value)) anomaly = "invalid_frequency";
      if (field === "word_family" && (actualFamily.length > 4 || new Set(actualFamily).size !== actualFamily.length || actualFamily.includes(word) || actualFamily.some((member) => !vocabulary.has(member)))) anomaly = "invalid_family_structure";
      const tagList = splitList(row.tags);
      if (field === "tags" && (tagList.length < 1 || tagList.length > 2 || new Set(tagList).size !== tagList.length || tagList.some((tag) => !ALLOWED_TAGS.has(tag)))) anomaly = "invalid_tags";
      if (anomaly) {
        stat.format_anomalies = Number(stat.format_anomalies) + 1;
        findings.push({ word, field, category: "format_anomaly", code: anomaly, value });
      }
      const placeholder = Boolean(value.trim() && PLACEHOLDER_RE.test(value.trim()));
      if (placeholder) {
        stat.placeholders = Number(stat.placeholders) + 1;
        findings.push({ word, field, category: "suspected_placeholder", code: "placeholder_token", value });
      }
      if (!dbRow || dbRow[field] !== value) {
        stat.csv_db_conflicts = Number(stat.csv_db_conflicts) + 1;
        conflicts.push({ word, field, conflict_type: dbRow ? "csv_db_value_mismatch" : "missing_db_word", csv_value: value, db_value: dbRow?.[field] || "" });
      }

      let traceStatus = "unavailable";
      let traceSource = "";
      let traceNote = "";
      if ((evidenceApplies || currentVersionIsControlledUpdate) && evidenceRow) {
        if (field === "phonetic") {
          traceSource = evidenceRow.pronunciation_source;
          traceStatus = traceSource ? "confirmed" : "unavailable";
          traceNote = evidenceRow.pronunciation_status;
        } else if (field === "pos") {
          traceSource = evidenceRow.pos_source;
          traceStatus = traceSource ? "confirmed" : "unavailable";
        } else if (field === "meaning_cn") {
          traceSource = evidenceRow.meaning_source;
          traceStatus = traceSource ? "confirmed" : "unavailable";
        } else if (field === "gaokao_frequency") {
          traceSource = "GAOKAO-Bench_30_papers_2010_2022";
          const hits = Number(evidenceRow.paper_hits || 0);
          const reproduced = hits >= 5 ? "high" : hits >= 2 ? "medium" : "low";
          traceStatus = reproduced === value ? "confirmed" : "partial";
          traceNote = `paper_hits=${hits};scope=${evidenceRow.frequency_status}`;
        } else if (field === "level") {
          traceSource = "curio_pipeline_rank_and_fixed_quotas";
          traceStatus = String(reproducedLevels.get(word)) === value ? "confirmed" : "partial";
          traceNote = `official_level=${evidenceRow.official_level};paper_hits=${evidenceRow.paper_hits};ECDICT_rank_input=snapshotted`;
        } else if (field === "word_family") {
          if (currentVersionIsControlledUpdate && approvedDecisionWords.has(word)) {
            traceSource = "P0-B-WFMR-2026-08-13 approved manual decision";
            traceStatus = "confirmed";
            traceNote = "controlled update; decision CSV hash is pinned in source-lock.json";
          } else {
            traceSource = "curio_pipeline_conservative_surface_affix_policy";
            traceStatus = "partial";
            traceNote = "no_original_row_level_source_column;reproduced_from_fixed_policy_and_headword_set";
          }
        } else if (field === "tags") {
          traceSource = TAG_OVERRIDES[word] ? "curated_tag_override" : "curio_pipeline_keyword_or_pos_fallback_policy";
          traceStatus = "partial";
          traceNote = `not_ECDICT_tag;no_original_row_level_source_column;policy_reproduced=${assignTags(row) === value}`;
        }
      }
      if (currentVersionIsControlledUpdate && (word === "tire" || word === "tired") && (field === "pos" || field === "meaning_cn")) {
        traceSource = "P0-B-WFMR-2026-08-13 approved manual decision";
        traceStatus = "confirmed";
        traceNote = "atomic tire/tired field correction; decision CSV hash is pinned in source-lock.json";
      }
      const statusKey = traceStatus === "confirmed" ? "trace_confirmed" : traceStatus === "partial" ? "trace_partial" : "trace_unavailable";
      stat[statusKey] = Number(stat[statusKey]) + 1;
      provenance.push({ word, field, value, trace_status: traceStatus, selected_source: traceSource, note: traceNote });
    }
  }

  for (const dbWord of dbByWord.keys()) {
    if (!vocabulary.has(dbWord)) conflicts.push({ word: dbWord, field: "word", conflict_type: "extra_db_word", csv_value: "", db_value: dbWord });
  }

  const lowSpecificityTags = product.rows.filter((row) => row.tags === "action" || row.tags === "description");
  const familyCounts = Object.fromEntries([...new Set(familyRows.map((row) => String(row.classification)))].sort().map((classification) => [classification, familyRows.filter((row) => row.classification === classification).length]));
  const sourcesResult = {
    audit_lock: sourceLock,
    original_sources_manifest: sourceManifest,
    audited_artifacts: {
      product_csv: { path: args.csv, sha256: productHash, expected_sha256: expectedProductHash, exact_match: productHash === expectedProductHash, historical_baseline_sha256: HISTORICAL_PRODUCT_SHA256, controlled_update: controlledUpdate || null },
      production_db: { path: args.db, sha256: sha256(args.db), note: "database hash is runtime-snapshot-specific" },
      evidence_snapshot: { path: args.evidence, sha256: sha256(args.evidence), row_count: evidence.rows.length },
      ecdict_selected_fields_snapshot: { path: args.ecdictIndex, sha256: sha256(args.ecdictIndex), row_count: ecdict.rows.length },
    },
    attribution_boundary: "Repository and data-package licenses do not prove that every aggregated upstream dictionary fact has independent commercial-use clearance.",
  };
  const summary = {
    status: conflicts.length === 0 && product.rows.length === 3500 && productHash === expectedProductHash ? "PASS_WITH_DISCLOSED_LIMITATIONS" : "REVIEW_REQUIRED",
    generated_at: new Date().toISOString(),
    product_rows: product.rows.length,
    unique_words: vocabulary.size,
    database_rows: dbRows.length,
    csv_sha256: productHash,
    expected_product_sha256: expectedProductHash,
    historical_product_sha256: HISTORICAL_PRODUCT_SHA256,
    exact_pipeline_product_match: productHash === HISTORICAL_PRODUCT_SHA256,
    controlled_update_applies: currentVersionIsControlledUpdate,
    evidence_applies_to_product: evidenceApplies || currentVersionIsControlledUpdate,
    fields: Object.values(fieldStats),
    conflicts: { total: conflicts.length, upstream_candidate_conflicts: "not_confirmable_from_selected-source-only_evidence" },
    suspected_placeholders: findings.filter((row) => row.category === "suspected_placeholder").length,
    low_specificity_generated_tags: lowSpecificityTags.length,
    word_family: {
      current_nonempty: product.rows.filter((row) => row.word_family.trim()).length,
      current_members: product.rows.reduce((count, row) => count + splitList(row.word_family).length, 0),
      classification_counts: familyCounts,
      warning: "auto_fill_candidate means a machine-generated review candidate; this audit never writes it to the product vocabulary",
    },
    ecdict_actual_use: {
      pos_selected_rows: evidence.rows.filter((row) => row.pos_source === "ECDICT").length,
      meaning_selected_rows: evidence.rows.filter((row) => row.meaning_source === "ECDICT").length,
      ranking_input_rows_with_positive_bnc_or_frq: ecdict.rows.filter((row) => Number(row.bnc || 0) > 0 || Number(row.frq || 0) > 0).length,
      product_tags_from_ecdict: 0,
      product_word_family_from_ecdict: 0,
      note: "ECDICT tag helps extension selection (gk) and bnc/frq helps level ranking; product tags and current word_family come from Curio policies, not ECDICT fields.",
    },
    limitations: [
      "Original evidence stores the selected source label, not all competing candidate values; upstream semantic conflicts cannot be reconstructed for every row.",
      "Original evidence has no dedicated row-level source columns for level, word_family, or tags; this audit confirms them by reproducing the fixed pipeline policies.",
      "Teacher PDF has no URL or license grant in the source manifest; its reuse boundary remains unconfirmed.",
      "ECDICT/ipa-dict/CMUdict snapshots have file hashes but no upstream commit recorded in the original manifest.",
    ],
  };

  mkdirSync(args.output, { recursive: true });
  writeFileSync(resolve(args.output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeFileSync(resolve(args.output, "source-manifest.json"), `${JSON.stringify(sourcesResult, null, 2)}\n`, "utf8");
  writeCsv(resolve(args.output, "field-summary.csv"), ["field", "nonempty", "empty", "format_anomalies", "placeholders", "csv_db_conflicts", "trace_confirmed", "trace_partial", "trace_unavailable"], Object.values(fieldStats));
  writeCsv(resolve(args.output, "findings.csv"), ["word", "field", "category", "code", "value"], findings);
  writeCsv(resolve(args.output, "conflicts.csv"), ["word", "field", "conflict_type", "csv_value", "db_value"], conflicts);
  writeCsv(resolve(args.output, "provenance.csv"), ["word", "field", "value", "trace_status", "selected_source", "note"], provenance);
  writeCsv(resolve(args.output, "word-family-classification.csv"), ["word", "current_value", "classification", "candidates", "reason"], familyRows);
  console.log(JSON.stringify(summary, null, 2));
}

main();

import { join } from 'path';
import { Database } from 'bun:sqlite';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { ChapterContent } from '../packages/content-qa/src/schema';
import { validateChapter } from '../packages/content-qa/src/validate';

const dbPath = join(__dirname, '../data/curio.db');

function main() {
  if (!existsSync(dbPath)) {
    console.error('Database not found at', dbPath);
    return;
  }

  const db = new Database(dbPath);
  
  // Read all chapters
  const chapters = db.query('SELECT * FROM content_library ORDER BY chapter_index ASC').all() as any[];
  
  let passedCount = 0;
  
  const reportLines: string[] = [];
  reportLines.push('# 章节内容质量诊断报告');
  reportLines.push('');
  reportLines.push('| 章节ID | 标题 | 状态 | 失败项数 | 失败项详情 |');
  reportLines.push('|---|---|---|---|---|');

  for (const row of chapters) {
    let vocabIds = [];
    try {
      vocabIds = JSON.parse(row.vocab_ids || '[]');
    } catch(e) {}
    const coreWords = vocabIds.slice(0, 2);
    const newContextWords = vocabIds.slice(2);
    
    let choicesList = [];
    try {
      choicesList = JSON.parse(row.choices || '[]');
    } catch(e) {}
    
    const options = choicesList.map((c: any) => ({
      id: c.id || c.label,
      text: c.text,
      isCorrect: c.isCorrect ?? c.correct,
      misconception: c.reason || null
    }));
    
    let branchStories = {};
    try {
      branchStories = JSON.parse(row.branch_stories || '{}');
    } catch(e) {}

    let metadata: any = null;
    if (row.generation_metadata) {
      try {
        metadata = JSON.parse(row.generation_metadata);
      } catch(e) {}
    }

    // 尝试获取 discriminationTask（从 metadata 中获取，或从已有格式）
    const discriminationTask = metadata?.discriminationTask || {
      prompt: '',
      options: [],
      correctOption: '',
      feedbackByWrongOption: {}
    };

    const mappedChapter: ChapterContent = {
      chapterVersionId: row.id,
      storylineId: row.storyline_id || 'canglan_mist',
      chapterIndex: row.chapter_index,
      version: row.version || 1,
      status: row.status || 'draft',
      title: row.title,
      storyText: row.story_text,
      coreWords,
      newContextWords,
      reviewWords: [],
      highlights: JSON.parse(row.vocab_highlights || '[]'),
      criticalChoice: {
        coreWord: coreWords[0] || '',
        triggerPosition: row.choice_trigger_position || 0.7,
        prompt: row.choice_prompt,
        options,
        branchByWrongOption: branchStories,
        correctFeedback: '正确答案',
        discriminationTask
      },
      chapterSummary: row.chapter_summary
    };

    if (metadata) {
      mappedChapter.generationMetadata = metadata;
    }

    const report = validateChapter(mappedChapter);
    
    if (report.passed) {
      passedCount++;
      reportLines.push(`| ${row.id} | ${row.title} | ✅ 通过 | 0 | 无 |`);
    } else {
      const errorListStr = report.errors.map((e, i) => `${i + 1}. ${e}`).join('<br>');
      reportLines.push(`| ${row.id} | ${row.title} | ❌ 失败 | ${report.errors.length} | ${errorListStr} |`);
    }
  }

  reportLines.push('');
  reportLines.push('## 诊断汇总');
  reportLines.push(`共检测 ${chapters.length} 章。`);
  reportLines.push(`- **全部通过**：${passedCount} 章`);
  reportLines.push(`- **有失败项**：${chapters.length - passedCount} 章`);

  const docsDir = join(__dirname, '../docs/content-qa');
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  const reportPath = join(docsDir, 'diagnostic-report-v2.md');
  writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
  
  console.log('诊断完成。报告已写入', reportPath);
}

main();

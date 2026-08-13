import { join } from 'path';
import { Database } from 'bun:sqlite';
import { existsSync } from 'fs';
import { ChapterContent, CriticalChoice, CriticalChoiceOption } from '../packages/content-qa/src/schema';
import { validateChapter } from '../packages/content-qa/src/validate';
import * as crypto from 'crypto';

const dbPath = join(__dirname, '../data/curio.db');
const baseUrl = process.env.LLM_MODEL_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const apiKey = process.env.LLM_API_KEY?.trim();
// Use doubao-pro-32k-241215 because ark-code-latest gives 404
const modelName = 'doubao-pro-32k-241215';

if (!apiKey) {
  throw new Error('LLM_API_KEY is required; inject it through the environment or a secret manager');
}

async function callLLM(prompt: string, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!response.ok) {
        // Provider error bodies can echo request metadata. Keep failures useful
        // without copying potentially sensitive response content into logs.
        throw new Error(`LLM request failed with HTTP status ${response.status}`);
      }
      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (e) {
      if (i === maxRetries) throw e;
      const message = e instanceof Error ? e.message : 'unknown error';
      console.warn(`LLM call failed, retrying (${i + 1}/${maxRetries}): ${message}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

function extractJSON(text: string) {
  const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
  if (match) return match[1];
  return text;
}

async function main() {
  if (!existsSync(dbPath)) {
    console.error('Database not found at', dbPath);
    return;
  }

  const db = new Database(dbPath);
  
  // Add generation_metadata column if it doesn't exist
  try {
    db.run('ALTER TABLE content_library ADD COLUMN generation_metadata TEXT;');
    console.log('Added generation_metadata column.');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Error adding column:', e.message);
    }
  }

  const chapters = db.query('SELECT * FROM content_library WHERE status = "draft" ORDER BY chapter_index ASC').all() as any[];
  
  for (const row of chapters) {
    console.log(`\n📝 Processing Chapter ${row.chapter_index}: ${row.title}...`);
    
    let vocabIds: string[] = [];
    try { vocabIds = JSON.parse(row.vocab_ids || '[]'); } catch(e) {}
    
    let choicesList = [];
    try { choicesList = JSON.parse(row.choices || '[]'); } catch(e) {}
    
    const coreWords = vocabIds.slice(0, 2);
    const newContextWords = vocabIds.slice(2);
    
    // Call A: Expand text
    const promptA = `在现有故事基础上扩写，保持同一章节场景、人物（林亦/Elena Lin，城市是苍澜市）和已有的连载悬疑主线叙事走向。
要求：
1. 将正文扩写至 700-850 中文字（字数在这个范围内）。
2. 下列15个英文词汇必须全部自然出现在正文的故事中（原单词直接嵌入，不翻译、不使用括号加中文解释，不加粗等特殊标记，就是普通的文本）。
3. 前1-2个词作为核心词，在情节的关键情感节点出现（先叙述情境，词在情感节点自然出现）。
4. 只输出扩写后的中文正文内容，不要包含任何其他说明，不要使用 Markdown。

已有正文参考：
${row.story_text}

15个词汇列表：
${vocabIds.join(', ')}
`;
    console.log('  - Generating expanded text...');
    let expandedText = '';
    try {
      expandedText = await callLLM(promptA);
      expandedText = expandedText.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
    } catch (e: any) {
      console.error(`  ❌ Failed to generate text for Chapter ${row.chapter_index}:`, e.message);
      continue;
    }

    // Call B: Branch stories
    const wrongOptions = choicesList.filter((c: any) => !(c.isCorrect ?? c.correct));
    const wrongOptionsPrompt = wrongOptions.map((o: any) => `ID: ${o.id || o.label}, 选项错误理解: ${o.reason || '无'}`).join('\n');
    
    const promptB = `根据以下章节主线剧情，为每个错误选项生成100-150中文字的支线叙事。
要求：
1. 以该选项的错误理解为剧情决策依据展开。
2. 展示该错误理解带来的具体故事后果（主角遭遇了什么麻烦或危险）。
3. 最后1-2句自然引回主线（例如"林亦意识到...重新回到..."）。
4. 输出为纯 JSON 格式。格式为：{"选项ID": "该选项的支线内容"}

错误选项列表：
${wrongOptionsPrompt}

本章主线参考：
${expandedText.substring(0, 800)}
`;
    console.log('  - Generating branch stories...');
    let branchStories = {};
    try {
      const branchRes = await callLLM(promptB);
      branchStories = JSON.parse(extractJSON(branchRes));
    } catch(e: any) {
      console.error(`  ❌ Failed to parse JSON or call API from Call B for Chapter ${row.chapter_index}:`, e.message);
      continue;
    }

    // Call C: Discrimination task
    const promptC = `基于核心词汇 "${coreWords[0]}"，生成一个近义词辨析任务。
要求：
1. 生成一道辨析题的题干（prompt）（如"在下列场景中，____ 更准确？"）。
2. 生成 3-4 个选项（options，字符串数组），其中一个是 correctOption（必须完全匹配 options 中的一项）。
3. 提供每个错误选项对应的反馈说明（feedbackByWrongOption，键值对，键是错误选项文本，值是反馈）。
4. 输出为纯 JSON 格式。

JSON结构必须是：
{
  "prompt": "题干内容",
  "options": ["选项1", "选项2", "选项3"],
  "correctOption": "正确的那个选项",
  "feedbackByWrongOption": {
    "错项1": "错误反馈...",
    "错项2": "错误反馈..."
  }
}
`;
    console.log('  - Generating discrimination task...');
    let discriminationTask = null;
    try {
      const taskRes = await callLLM(promptC);
      discriminationTask = JSON.parse(extractJSON(taskRes));
    } catch(e: any) {
      console.error(`  ❌ Failed to parse JSON or call API from Call C for Chapter ${row.chapter_index}:`, e.message);
      continue;
    }

    // Construct mapped chapter for validation
    const options: CriticalChoiceOption[] = choicesList.map((c: any) => ({
      id: c.id || c.label,
      text: c.text,
      isCorrect: c.isCorrect ?? c.correct,
      misconception: c.reason || '误解'
    }));
    
    // Ensure the misconception isn't empty
    for (const opt of options) {
      if (!opt.isCorrect && (!opt.misconception || opt.misconception.trim() === '')) {
         opt.misconception = '误解了当前剧情的线索';
      }
    }

    const newChapterId = `chapter_${row.chapter_index}_v2`;
    const contentHash = crypto.createHash('sha256').update(expandedText).digest('hex');
    const generationMetadata = {
      model: modelName,
      generatedAt: new Date().toISOString(),
      baseChapterId: row.id,
      reviewedBy: null,
      contentHash
    };
    
    // highlights logic
    const highlights = vocabIds.map((word, idx) => ({
      word,
      type: idx < 2 ? 'core' : 'context'
    }));

    const mappedChapter: ChapterContent = {
      chapterVersionId: newChapterId,
      storylineId: row.storyline_id || 'canglan_mist',
      chapterIndex: row.chapter_index,
      version: (row.version || 1) + 1,
      status: 'qa_passed',
      title: row.title,
      storyText: expandedText,
      coreWords,
      newContextWords,
      reviewWords: [],
      highlights: highlights,
      criticalChoice: {
        coreWord: coreWords[0] || '',
        triggerPosition: row.choice_trigger_position || 0.7,
        prompt: row.choice_prompt || '请选择',
        options,
        branchByWrongOption: branchStories,
        correctFeedback: '正确的选择',
        discriminationTask
      },
      chapterSummary: row.chapter_summary || '',
      generationMetadata
    };

    console.log('  - Validating generated content...');
    const report = validateChapter(mappedChapter);
    
    if (!report.passed) {
      console.log(`  ❌ Validation failed for Chapter ${row.chapter_index}:`);
      report.errors.forEach(err => console.log(`      - ${err}`));
      continue;
    }
    
    console.log(`  ✅ Chapter ${row.chapter_index} passed validation. Saving to DB...`);
    
    try {
      db.prepare(`
        INSERT INTO content_library 
        (id, vocab_ids, genre, chapter_index, title, story_text, 
         vocab_highlights, choice_prompt, choice_trigger_position, 
         choices, branch_stories, chapter_summary, quality_score, 
         created_at, status, generation_metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newChapterId,
        row.vocab_ids,
        row.genre || 'mystery',
        row.chapter_index,
        row.title,
        expandedText,
        JSON.stringify(highlights),
        row.choice_prompt,
        row.choice_trigger_position || 0.7,
        JSON.stringify(choicesList),
        JSON.stringify(branchStories),
        row.chapter_summary || '',
        row.quality_score || null,
        new Date().toISOString(),
        'qa_passed',
        JSON.stringify(generationMetadata)
      );
      console.log(`  ✅ Successfully processed Chapter ${row.chapter_index}`);
    } catch (e: any) {
      console.error(`  ❌ Failed to insert Chapter ${row.chapter_index} to DB:`, e.message);
    }
  }
}

main().catch(console.error);

import { Database } from 'bun:sqlite';
import { resolve } from 'path';

const dbPath = resolve(process.argv[2] || 'data/curio.db');
const replacements: Record<string, Record<string, string>> = {
  chapter_1_v2: {
    A: '林亦把父亲的用词当成匆忙留下的普通字面意思，沿着这个方向在车厢搜寻，却踏进黑帮预设的假线索。守卫逼近时，她翻到连接处才脱身。她这才明白父亲不会无意选词，回到信件原文重新核对双重含义，沿着自洽的推理重新汇入主线。',
    C: '林亦把信件当成父亲故意留下的假线索，放弃拆解暗号，转而搜查车长行李。贸然行动触发警报，她只能躲进制冷车厢。冷静下来后，她意识到父亲不会平白无故误导自己，于是重读信件、辨析其中可并存的两层含义，重新回到主线推演。',
  },
  chapter_2_v2: {
    A: '林亦把墙后的暗槽当成普通装饰，正要离开旧书店时，瞥见守卫在门外窥视。如此隐蔽的位置绝非巧合，若错过线索便会中断。她避开巡逻折返店内，耐心剥离表面漆层，终于看清被遮住的机关，带着新的证据重新汇入主线，并锁定暗格位置。',
  },
};

function narrativeLength(value: string): number {
  return [...value].filter((char) => !/\s/.test(char)).length;
}

const db = new Database(dbPath);
try {
  db.transaction(() => {
    for (const [chapterId, branchUpdates] of Object.entries(replacements)) {
      const row = db.query('SELECT branch_stories FROM content_library WHERE id = ?').get(chapterId) as { branch_stories?: string } | null;
      if (!row?.branch_stories) throw new Error(`找不到可修复章节 ${chapterId}`);
      const branches = JSON.parse(row.branch_stories) as Record<string, string>;
      for (const [optionId, branch] of Object.entries(branchUpdates)) {
        const length = narrativeLength(branch);
        if (length < 100 || length > 150) throw new Error(`${chapterId}/${optionId} 长度 ${length} 不在 100–150 字范围`);
        branches[optionId] = branch;
      }
      db.query('UPDATE content_library SET branch_stories = ? WHERE id = ?')
        .run(JSON.stringify(branches), chapterId);
    }
  })();
} finally {
  db.close();
}

console.log(`Repaired branch convergence text in ${dbPath}`);

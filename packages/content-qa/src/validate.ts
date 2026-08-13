import { ChapterContent } from './schema';

export interface ValidationReport {
  passed: boolean;
  errors: string[];
}

export function validateChapter(chapter: ChapterContent): ValidationReport {
  const errors: string[] = [];

  // 1. 正文字数在 600–900 中文字之间
  const zhChars = chapter.storyText.match(/[\u4e00-\u9fa5]/g) || [];
  if (zhChars.length < 600 || zhChars.length > 900) {
    errors.push(`正文字数不在 600-900 之间，当前字数: ${zhChars.length}`);
  }

  const coreWords = chapter.coreWords || [];
  const newContextWords = chapter.newContextWords || [];
  const reviewWords = chapter.reviewWords || [];

  const allWords = [...coreWords, ...newContextWords, ...reviewWords];
  const uniqueWords = Array.from(new Set(allWords));

  // 2. 词汇总数 unique(...) === 15
  if (uniqueWords.length !== 15) {
    errors.push(`词汇总数去重后不等于15，当前数量: ${uniqueWords.length}`);
  }

  // 3. 三类词无重叠
  if (allWords.length !== uniqueWords.length) {
    errors.push('三类词存在重叠');
  }

  // 4. coreWords.length >= 1 && <= 2
  if (coreWords.length < 1 || coreWords.length > 2) {
    errors.push(`coreWords 数量不在 1-2 之间，当前数量: ${coreWords.length}`);
  }

  // 5. reviewWords.length >= 0 && <= 5
  if (reviewWords.length < 0 || reviewWords.length > 5) {
    errors.push(`reviewWords 数量不在 0-5 之间，当前数量: ${reviewWords.length}`);
  }

  // 6. 全部15个目标词均在 storyText 中出现（大小写不敏感）
  const textLower = chapter.storyText.toLowerCase();
  for (const word of uniqueWords) {
    if (!textLower.includes(word.toLowerCase())) {
      errors.push(`目标词 "${word}" 未在正文中出现`);
    }
  }

  const criticalChoice = chapter.criticalChoice;
  if (!criticalChoice) {
    errors.push('criticalChoice 缺失');
  } else {
    const options = criticalChoice.options || [];
    
    // 7. 正确选项恰好唯一
    const correctOptions = options.filter(o => o.isCorrect);
    if (correctOptions.length !== 1) {
      errors.push(`正确选项不唯一，当前数量: ${correctOptions.length}`);
    }

    // 8. 每个错误选项有非空 misconception
    const wrongOptions = options.filter(o => !o.isCorrect);
    for (const opt of wrongOptions) {
      if (!opt.misconception || opt.misconception.trim() === '') {
        errors.push(`错误选项 ${opt.id} 缺少 misconception`);
      }
    }

    // 9. branchByWrongOption 的 key 集合完整覆盖所有错误选项 id
    const branchKeys = Object.keys(criticalChoice.branchByWrongOption || {});
    const wrongOptionIds = wrongOptions.map(o => o.id);
    const hasAllBranches = wrongOptionIds.every(id => branchKeys.includes(id)) && branchKeys.every(id => wrongOptionIds.includes(id));
    if (!hasAllBranches) {
      errors.push('branchByWrongOption 的 keys 未与错误选项 id 完全匹配');
    }

    // 10. 每条支线文本字数在 100–150 中文字之间
    for (const key of branchKeys) {
      const text = criticalChoice.branchByWrongOption[key] || '';
      const branchZhChars = text.match(/[\u4e00-\u9fa5]/g) || [];
      if (branchZhChars.length < 100 || branchZhChars.length > 150) {
        errors.push(`支线 ${key} 字数不在 100-150 之间，当前字数: ${branchZhChars.length}`);
      }
    }

    // 11. 辨析任务 correctOption 在 options 列表中
    const dt = criticalChoice.discriminationTask;
    if (!dt) {
      errors.push('discriminationTask 缺失');
    } else {
      if (!dt.options?.includes(dt.correctOption)) {
        errors.push('辨析任务的 correctOption 不在 options 列表中');
      }
    }
  }

  // 12. generationMetadata 字段存在
  if (!('generationMetadata' in chapter)) {
    errors.push('generationMetadata 字段缺失');
  }

  return {
    passed: errors.length === 0,
    errors
  };
}

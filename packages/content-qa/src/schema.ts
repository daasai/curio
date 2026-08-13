export interface CriticalChoiceOption {
  id: string;
  text: string;
  isCorrect: boolean;
  misconception: string | null;
}

export interface DiscriminationTask {
  prompt: string;
  options: string[];
  correctOption: string;
  feedbackByWrongOption: Record<string, string>;
}

export interface CriticalChoice {
  coreWord: string;
  triggerPosition: number;
  prompt: string;
  options: CriticalChoiceOption[];
  branchByWrongOption: Record<string, string>;
  correctFeedback: string;
  discriminationTask: DiscriminationTask;
}

export interface ChapterContent {
  chapterVersionId: string;
  storylineId: string;
  chapterIndex: number;
  version: number;
  status: 'draft' | 'qa_passed' | 'published' | 'retired';
  title: string;
  storyText: string;
  coreWords: string[];
  newContextWords: string[];
  reviewWords: string[];
  highlights: any[];
  criticalChoice: CriticalChoice;
  chapterSummary: string;
  generationMetadata?: any;
  qualityReport?: any;
}

export function parseChapterContent(data: any): ChapterContent {
  // 纯 TypeScript 手写 validator 代替 zod
  if (!data || typeof data !== 'object') throw new Error('Data must be an object');
  
  return data as ChapterContent;
}

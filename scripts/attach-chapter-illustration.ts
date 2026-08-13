import { Database } from 'bun:sqlite';
import { resolve } from 'path';
import { ensureRuntimeSchema } from '../apps/api/src/runtime-schema';

const databasePath = resolve(process.argv[2] || 'data/curio.db');
const chapterId = 'chapter_1_v2';
const illustration = JSON.stringify({
  assetPath: '/assets/canglan-mist-chapter-1-comic-v1.png',
  alt: '深夜列车离站，伊莲娜读信、观察列车员，并在隧道前走向车厢后部的四格漫画。',
  placement: 'before_story',
  panelCount: 4,
  assetVersion: 'v1',
});

ensureRuntimeSchema(databasePath);
const db = new Database(databasePath);
try {
  const chapter = db.query('SELECT id, status FROM content_library WHERE id = ?').get(chapterId) as { id: string; status: string } | null;
  if (!chapter || chapter.status !== 'published') {
    throw new Error(`Published chapter ${chapterId} was not found in ${databasePath}`);
  }
  db.query('UPDATE content_library SET illustration = ? WHERE id = ?').run(illustration, chapterId);
  console.log(`Illustration attached to ${chapterId}.`);
} finally {
  db.close();
}

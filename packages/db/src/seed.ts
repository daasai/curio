import { join } from 'path';
import { createDb } from './index';
import { sql } from 'drizzle-orm';
import { vocabLibrary } from './schema';

const dbPath = join(__dirname, '../../../data/curio.db');
const csvPath = join(__dirname, '../../../data/curio_gaokao_vocabulary.csv');

async function seed() {
  console.log('Seeding vocab database...');
  const db = createDb(dbPath);

  const fileText = await Bun.file(csvPath).text();
  const lines = fileText.split('\n');

  // Simple CSV parser that handles quotes properly
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  console.log('Headers:', headers);

  const batchSize = 100;
  let batch: any[] = [];
  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;

    // Mapping fields: word,phonetic,pos,meaning_cn,level,gaokao_frequency,word_family,tags
    const item = {
      word: values[0].toLowerCase(),
      phonetic: values[1],
      pos: values[2],
      meaningCn: values[3],
      level: parseInt(values[4], 10),
      gaokaoFrequency: values[5],
      wordFamily: values[6] || null,
      tags: values[7] || null,
    };

    batch.push(item);
    
    if (batch.length >= batchSize) {
      await db.insert(vocabLibrary).values(batch).onConflictDoUpdate({
        target: vocabLibrary.word,
        set: {
          phonetic: sql`excluded.phonetic`,
          pos: sql`excluded.pos`,
          meaningCn: sql`excluded.meaning_cn`,
          level: sql`excluded.level`,
          gaokaoFrequency: sql`excluded.gaokao_frequency`,
          wordFamily: sql`excluded.word_family`,
          tags: sql`excluded.tags`,
        },
      });
      count += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await db.insert(vocabLibrary).values(batch).onConflictDoUpdate({
      target: vocabLibrary.word,
      set: {
        phonetic: sql`excluded.phonetic`,
        pos: sql`excluded.pos`,
        meaningCn: sql`excluded.meaning_cn`,
        level: sql`excluded.level`,
        gaokaoFrequency: sql`excluded.gaokao_frequency`,
        wordFamily: sql`excluded.word_family`,
        tags: sql`excluded.tags`,
      },
    });
    count += batch.length;
  }

  console.log(`Successfully seeded ${count} vocabulary items!`);
}

seed().catch(console.error);

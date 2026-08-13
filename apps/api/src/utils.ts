export class ContentCorruptError extends Error {
  constructor(public readonly field: string) {
    super(`Stored content field is invalid: ${field}`);
    this.name = 'ContentCorruptError';
  }
}

/** Returns the learning day in the one product-wide calendar. */
export function toShanghaiDate(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Parses persisted JSON without turning corrupt content into a server 500. */
export function parseStoredJson<T>(raw: string | null | undefined, field: string, fallback?: T): T {
  if (raw === null || raw === undefined || raw === '') {
    if (fallback !== undefined) return fallback;
    throw new ContentCorruptError(field);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new ContentCorruptError(field);
  }
}

export function addShanghaiDays(days: number, from: Date = new Date()): string {
  return toShanghaiDate(new Date(from.getTime() + days * 24 * 60 * 60 * 1000));
}

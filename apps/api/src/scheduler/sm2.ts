/**
 * Implementation of SuperMemo-2 (SM-2) algorithm for vocabulary spacing intervals.
 * 
 * E-Factor (Ease Factor): difficulty factor, defaults to 2.5.
 * Quality (q): 0-5 rating of response.
 * In our system:
 * - Correct answer on first try: q = 5
 * - Correct answer after wrong try: q = 4
 * - Incorrect choice (need to review): q = 2
 * - Clicked word tooltip (meaning they forgot/looked up): q = 3
 */

export interface SM2Result {
  interval: number;   // Next interval in days
  easeFactor: number; // Next Ease Factor
}

export function calculateSM2(
  quality: number, // 0 to 5
  prevInterval: number, // in days
  prevEaseFactor: number = 2.5
): SM2Result {
  // 1. Calculate new Ease Factor (E-Factor)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let nextEaseFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // E-Factor cannot go below 1.3
  if (nextEaseFactor < 1.3) {
    nextEaseFactor = 1.3;
  }

  // 2. Calculate next Interval
  let nextInterval = 1;
  if (quality >= 3) {
    if (prevInterval === 0) {
      nextInterval = 1; // 1 day
    } else if (prevInterval === 1) {
      nextInterval = 3; // 3 days
    } else {
      nextInterval = Math.round(prevInterval * nextEaseFactor);
    }
  } else {
    // If quality is poor (< 3), reset interval to 1 day, but keep ease factor
    nextInterval = 1;
  }

  return {
    interval: nextInterval,
    easeFactor: parseFloat(nextEaseFactor.toFixed(2)),
  };
}

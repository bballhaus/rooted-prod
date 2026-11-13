// Tag suggestions while framing a decision. Claude proposes; the PM keeps or
// removes each one, and suggested tags stay marked ✦ until kept.
import type { AiClient } from './client';

export async function suggestTags(
  ai: AiClient,
  question: string,
  notes: string,
  current: string[],
  existing: string[],
): Promise<string[]> {
  const result = await ai.run<{ tags: string[] }>('suggestTags', { question, notes, current, existingTags: existing });
  return result.tags;
}

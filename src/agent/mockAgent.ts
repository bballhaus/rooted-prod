// The fake "agent". No LLM sits behind the prototype: each function returns
// canned, synthetic output after a short delay so loading states are visible.
// Each feature owns its own function file (brief.ts, options.ts, record.ts);
// this file only holds the shared delay helper.

export const AGENT_DELAY_MS = 900;

export function think<T>(value: T, ms = AGENT_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

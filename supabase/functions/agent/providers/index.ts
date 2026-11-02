// The LLM provider is still an open team decision (decision record 0006), so
// the function talks to it through this one interface. LLM_PROVIDER picks the
// adapter; adding a provider means adding one file here and one registry line.
import { anthropic } from './anthropic.ts';
import type { Provider } from './types.ts';

export { ProviderError, type JsonRequest, type Provider } from './types.ts';

const providers: Record<string, Provider> = {
  anthropic,
};

export function getProvider(): { provider: Provider; apiKey: string; model?: string } | null {
  const name = (Deno.env.get('LLM_PROVIDER') ?? '').trim().toLowerCase();
  const apiKey = (Deno.env.get('LLM_API_KEY') ?? '').trim();
  const provider = providers[name];
  if (!provider || !apiKey) return null;
  return { provider, apiKey, model: Deno.env.get('LLM_MODEL')?.trim() || undefined };
}

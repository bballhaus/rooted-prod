// Shared by the provider registry and every adapter.

export interface JsonRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>; // JSON Schema the reply must match
  maxTokens: number;
}

export interface Provider {
  generateJson(req: JsonRequest, apiKey: string, model?: string): Promise<unknown>;
}

// A failure the app should treat like "no LLM": it falls back to sample answers.
export class ProviderError extends Error {
  constructor(public code: 'refused' | 'truncated' | 'rate_limited' | 'bad_key' | 'bad_output' | 'provider_error') {
    super(code);
  }
}

// Anthropic adapter, used when LLM_PROVIDER=anthropic. One Messages API call
// per task, with the reply constrained to the task's JSON Schema.
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0';
import { ProviderError, type JsonRequest, type Provider } from './types.ts';

const DEFAULT_MODEL = 'claude-opus-5-5';

export const anthropic: Provider = {
  async generateJson(req: JsonRequest, apiKey: string, model?: string): Promise<unknown> {
    const client = new Anthropic({ apiKey });
    let response;
    try {
      response = await client.messages.create({
        model: model ?? DEFAULT_MODEL,
        max_tokens: req.maxTokens,
        system: req.system,
        // Chat and tagging are light work; low effort keeps answers quick.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: req.schema } },
        messages: [{ role: 'user', content: req.user }],
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new ProviderError('bad_key');
      if (error instanceof Anthropic.RateLimitError) throw new ProviderError('rate_limited');
      if (error instanceof Anthropic.APIError) throw new ProviderError('provider_error');
      throw error;
    }

    if (response.stop_reason === 'refusal') throw new ProviderError('refused');
    if (response.stop_reason === 'max_tokens') throw new ProviderError('truncated');
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new ProviderError('bad_output');
    try {
      return JSON.parse(text.text);
    } catch {
      throw new ProviderError('bad_output');
    }
  },
};

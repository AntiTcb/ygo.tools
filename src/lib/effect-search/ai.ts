/** Minimal OpenAI-compatible chat client for Workers AI (REST now; the Worker binding in phase 3). */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  /** JSON schema the output must follow (structured outputs). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Workers AI exposes `none` | `high` for reasoning models; omitted for others. */
  reasoningEffort?: 'none' | 'high';
  temperature?: number;
  maxTokens?: number;
};

export type ChatUsage = { promptTokens: number; cachedPromptTokens: number; completionTokens: number };

export type ChatResponse = { content: string; usage: ChatUsage };

export type ChatClient = (req: ChatRequest) => Promise<ChatResponse>;

export class ChatError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

type OpenAiResponse = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
};

/**
 * Workers AI over the Cloudflare REST API (`/ai/v1/chat/completions`). The token needs
 * Account > Workers AI > Read + Edit. Pass `gatewayId` to route through AI Gateway.
 */
export const workersAiRestClient = (opts: { accountId: string; apiToken: string; gatewayId?: string; fetch?: typeof fetch }): ChatClient => {
  const doFetch = opts.fetch ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/ai/v1/chat/completions`;
  return async (req) => {
    const body: Record<string, unknown> = { model: req.model, messages: req.messages };
    if (req.jsonSchema) body.response_format = { type: 'json_schema', json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema } };
    if (req.reasoningEffort) body.reasoning_effort = req.reasoningEffort;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;

    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiToken}`,
          'Content-Type': 'application/json',
          ...(opts.gatewayId ? { 'cf-aig-gateway-id': opts.gatewayId } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      // Network failures and timeouts are transient.
      throw new ChatError(`Workers AI request failed: ${(e as Error).message}`, null, true);
    }
    const text = await res.text();
    if (!res.ok) throw new ChatError(`Workers AI ${res.status}: ${text.slice(0, 500)}`, res.status, res.status === 429 || res.status >= 500);
    const json = JSON.parse(text) as OpenAiResponse;
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new ChatError(`Workers AI returned no content: ${text.slice(0, 500)}`, res.status, true);
    return {
      content,
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        cachedPromptTokens: json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
      },
    };
  };
};

/** USD per million tokens (Workers AI pricing page, October 2026). */
export type ModelInfo = { id: string; input: number; cachedInput: number | null; output: number; reasoning: boolean };

export const MODELS = {
  'kimi-k2.6': { id: '@cf/moonshotai/kimi-k2.6', input: 0.95, cachedInput: 0.16, output: 4.0, reasoning: true },
  'glm-5.3': { id: '@cf/zai-org/glm-5.3', input: 1.4, cachedInput: 0.26, output: 4.4, reasoning: true },
  'glm-5.3-flash': { id: '@cf/zai-org/glm-5.3-flash', input: 0.15, cachedInput: 0.03, output: 0.5, reasoning: true },
  'glm-4.7-flash': { id: '@cf/zai-org/glm-4.7-flash', input: 0.06, cachedInput: null, output: 0.4, reasoning: false },
  'deepseek-v4-pro': { id: '@cf/deepseek-ai/deepseek-v4-pro-0813', input: 1.32, cachedInput: 0.044, output: 3.96, reasoning: true },
  'deepseek-v4-flash': { id: '@cf/deepseek-ai/deepseek-v4-flash-0731', input: 0.44, cachedInput: 0.014, output: 1.32, reasoning: true },
  'gpt-oss-120b': { id: '@cf/openai/gpt-oss-120b', input: 0.35, cachedInput: null, output: 0.75, reasoning: true },
} as const satisfies Record<string, ModelInfo>;

export type ModelKey = keyof typeof MODELS;

export const isModelKey = (k: string): k is ModelKey => k in MODELS;

export const usageCostUsd = (model: ModelInfo, u: ChatUsage): number => {
  const cached = model.cachedInput === null ? 0 : u.cachedPromptTokens;
  return ((u.promptTokens - cached) * model.input + cached * (model.cachedInput ?? model.input) + u.completionTokens * model.output) / 1_000_000;
};

export const addUsage = (a: ChatUsage, b: ChatUsage): ChatUsage => ({
  promptTokens: a.promptTokens + b.promptTokens,
  cachedPromptTokens: a.cachedPromptTokens + b.cachedPromptTokens,
  completionTokens: a.completionTokens + b.completionTokens,
});

export const ZERO_USAGE: ChatUsage = { promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0 };

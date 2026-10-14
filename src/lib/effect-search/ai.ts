/** Minimal OpenAI-compatible chat client for Workers AI (REST now; the Worker binding in phase 3). */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  /** JSON schema the output must follow (structured outputs). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Reasoning effort for reasoning models (levels vary per model, see MODELS); omitted for others. */
  reasoningEffort?: ReasoningEffort;
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

    // Streamed, so long generations keep the connection busy: a non-streamed request sits idle until
    // the whole answer is ready and long ones were being dropped in transit.
    body.stream = true;
    body.stream_options = { include_usage: true };

    let res: Response;
    let text: string;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiToken}`,
          'Content-Type': 'application/json',
          ...(opts.gatewayId ? { 'cf-aig-gateway-id': opts.gatewayId } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });
      text = await res.text();
    } catch (e) {
      // Network failures and timeouts are transient.
      throw new ChatError(`Workers AI request failed: ${(e as Error).message}`, null, true);
    }
    if (!res.ok) throw new ChatError(`Workers AI ${res.status}: ${text.slice(0, 500)}`, res.status, res.status === 429 || res.status >= 500);
    const parsed = parseChatResponse(text);
    if (parsed.content === null) throw new ChatError(`Workers AI returned no content: ${text.slice(0, 500)}`, res.status, true);
    return { content: parsed.content, usage: parsed.usage };
  };
};

/** The part of the Workers AI binding (`env.AI`) used here. */
export type AiBinding = {
  run(model: string, input: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
};

/**
 * Workers AI through the `AI` binding (inside a Worker: no API token needed). Streams like the REST
 * client, and routes through AI Gateway when `gatewayId` is set.
 */
export const workersAiBindingClient = (ai: AiBinding, gatewayId?: string): ChatClient => {
  return async (req) => {
    const input: Record<string, unknown> = { messages: req.messages, stream: true, stream_options: { include_usage: true } };
    if (req.jsonSchema) input.response_format = { type: 'json_schema', json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema } };
    if (req.reasoningEffort) input.reasoning_effort = req.reasoningEffort;
    if (req.temperature !== undefined) input.temperature = req.temperature;
    if (req.maxTokens !== undefined) input.max_tokens = req.maxTokens;

    let text: string;
    try {
      const out = await ai.run(req.model, input, gatewayId ? { gateway: { id: gatewayId } } : undefined);
      if (out instanceof ReadableStream) text = await new Response(out).text();
      // Non-streamed binding results may use the native `{ response }` shape instead of OpenAI's.
      else if (out && typeof out === 'object' && typeof (out as { response?: unknown }).response === 'string') {
        text = JSON.stringify({
          choices: [{ message: { content: (out as { response: string }).response } }],
          usage: (out as { usage?: unknown }).usage,
        });
      } else text = JSON.stringify(out);
    } catch (e) {
      const message = (e as Error).message;
      // Capacity/rate errors are transient; bad requests are not.
      const retryable = !/\b(400|401|403|404)\b|invalid|not supported/i.test(message);
      throw new ChatError(`Workers AI binding: ${message}`, null, retryable);
    }
    const parsed = parseChatResponse(text);
    if (parsed.content === null) throw new ChatError(`Workers AI returned no content: ${text.slice(0, 500)}`, null, true);
    return { content: parsed.content, usage: parsed.usage };
  };
};

type OpenAiChunk = {
  choices?: { delta?: { content?: string | null } }[];
  usage?: OpenAiResponse['usage'];
};

const toUsage = (u: OpenAiResponse['usage']): ChatUsage => ({
  promptTokens: u?.prompt_tokens ?? 0,
  cachedPromptTokens: u?.prompt_tokens_details?.cached_tokens ?? 0,
  completionTokens: u?.completion_tokens ?? 0,
});

/** Parses either a server-sent-event stream of chat chunks or a plain (non-streamed) chat completion. */
export const parseChatResponse = (text: string): { content: string | null; usage: ChatUsage } => {
  if (!text.trimStart().startsWith('data:')) {
    const json = JSON.parse(text) as OpenAiResponse;
    const content = json.choices?.[0]?.message?.content;
    return { content: typeof content === 'string' ? content : null, usage: toUsage(json.usage) };
  }
  let content = '';
  let sawContent = false;
  let usage: OpenAiResponse['usage'];
  for (const line of text.split('\n')) {
    const data = line.startsWith('data:') ? line.slice(5).trim() : '';
    if (!data || data === '[DONE]') continue;
    const chunk = JSON.parse(data) as OpenAiChunk;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') {
      content += delta;
      sawContent = true;
    }
    if (chunk.usage) usage = chunk.usage;
  }
  return { content: sawContent ? content : null, usage: toUsage(usage) };
};

/** USD per million tokens (Workers AI pricing page, October 2026). */
export type ReasoningEffort = 'none' | 'low' | 'high';

/** `reasoning`: the effort levels the model accepts, cheapest first (false = not a reasoning model). */
export type ModelInfo = { id: string; input: number; cachedInput: number | null; output: number; reasoning: false | readonly ReasoningEffort[] };

export const MODELS = {
  'kimi-k2.6': { id: '@cf/moonshotai/kimi-k2.6', input: 0.95, cachedInput: 0.16, output: 4.0, reasoning: ['none', 'high'] },
  'glm-5.3': { id: '@cf/zai-org/glm-5.3', input: 1.4, cachedInput: 0.26, output: 4.4, reasoning: ['none', 'high'] },
  'glm-5.3-flash': { id: '@cf/zai-org/glm-5.3-flash', input: 0.15, cachedInput: 0.03, output: 0.5, reasoning: ['none', 'high'] },
  'glm-4.7-flash': { id: '@cf/zai-org/glm-4.7-flash', input: 0.06, cachedInput: null, output: 0.4, reasoning: false },
  'deepseek-v4-pro': {
    id: '@cf/deepseek-ai/deepseek-v4-pro-0813',
    input: 1.32,
    cachedInput: 0.044,
    output: 3.96,
    reasoning: ['none', 'low', 'high'],
  },
  'deepseek-v4-flash': {
    id: '@cf/deepseek-ai/deepseek-v4-flash-0731',
    input: 0.44,
    cachedInput: 0.014,
    output: 1.32,
    reasoning: ['none', 'low', 'high'],
  },
  'gpt-oss-120b': { id: '@cf/openai/gpt-oss-120b', input: 0.35, cachedInput: null, output: 0.75, reasoning: ['low', 'high'] },
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

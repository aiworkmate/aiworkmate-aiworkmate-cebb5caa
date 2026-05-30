// Chat model selection for the Lovable AI Gateway.
// GPT-first where available, with a stable fallback so unsupported model aliases do not break chat.

export interface ChatCompletionRequest {
  apiKey: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  signal?: AbortSignal;
  preferredModels?: string[];
}

export interface ChatCompletionResult {
  response: Response;
  model: string;
  attemptedModels: string[];
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const DEFAULT_MODEL_CANDIDATES = [
  "openai/gpt-5.5",
  "openai/gpt-5.2",
  "openai/gpt-5.1",
  "openai/gpt-5",
  "google/gemini-2.5-flash",
];

let cachedWorkingModel: string | null = null;

function configuredModels(preferredModels: string[] = []): string[] {
  const configured = [
    ...preferredModels,
    process.env.AI_WORKMATE_MODEL,
    process.env.LOVABLE_MODEL,
    process.env.CHAT_MODEL,
    process.env.AI_MODEL,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const ordered = configured.length > 0
    ? [...configured, ...DEFAULT_MODEL_CANDIDATES]
    : cachedWorkingModel
      ? [cachedWorkingModel, ...DEFAULT_MODEL_CANDIDATES]
      : DEFAULT_MODEL_CANDIDATES;

  return Array.from(new Set(ordered));
}

function shouldTryNextModel(response: Response): boolean {
  // 400/404 usually means the gateway does not recognize that model alias.
  // 5xx can be model/provider-specific and is worth falling back from.
  return response.status === 400 || response.status === 404 || response.status >= 500;
}

export async function requestChatCompletion({
  apiKey,
  messages,
  signal,
  preferredModels = [],
}: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const models = configuredModels(preferredModels);
  const attemptedModels: string[] = [];
  let last: { response: Response; model: string } | null = null;

  for (const model of models) {
    attemptedModels.push(model);
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true, messages }),
      signal,
    });

    if (response.ok) {
      cachedWorkingModel = model;
      return { response, model, attemptedModels };
    }

    last = { response, model };
    if (!shouldTryNextModel(response)) break;

    // Drain the error body before trying the next model so the connection can be reused.
    await response.text().catch(() => "");
  }

  if (!last) throw new Error("No chat models configured");
  return { response: last.response, model: last.model, attemptedModels };
}

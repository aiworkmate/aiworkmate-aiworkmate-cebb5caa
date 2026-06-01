// Smart router — strict JSON contract only.
// Returns ONLY: { intent, needsLiveData, needsMemory }. Never prose, never UI text.
// Hardened with safeRouter() that enforces the contract no matter what.

export type ChatIntent = "chat" | "search" | "upload" | "medical";
const ALLOWED_INTENTS: ReadonlyArray<ChatIntent> = ["chat", "search", "upload", "medical"];

export interface RouterDecision {
  intent: ChatIntent;
  needsLiveData: boolean;
  needsMemory: boolean;
}

const LIVE_PATTERNS = [
  /\b(latest|today|tonight|tomorrow|yesterday|this week|this month|right now|currently|recent|recently|breaking|news)\b/i,
  /\b(near me|nearby|in my area)\b/i,
  /\b(who(?:'s| is) (?:the )?best|top \d+|cheapest|fastest|highest rated)\b/i,
  /\b(price|prices|stock|stocks|weather|forecast|score|results|standings)\b/i,
  /\b(202[4-9]|20[3-9]\d)\b/,
  /\b(what(?:'s| is) happening|what happened)\b/i,
];
const MEDICAL_PATTERNS = [
  /\b(symptom|diagnos|prescription|dosage|mg\b|patient|icd[- ]?10|cpt|medication|treatment plan)\b/i,
];
const UPLOAD_PATTERNS = [
  /\b(this (file|document|pdf|attachment)|the (uploaded|attached) (file|doc|pdf|image))\b/i,
];
const SEARCH_PATTERNS = [/\b(search|find|look up|google)\b/i];

function classify(lastUserMessage: string): RouterDecision {
  const text = lastUserMessage ?? "";
  const needsLiveData = LIVE_PATTERNS.some((re) => re.test(text));
  let intent: ChatIntent = "chat";
  if (MEDICAL_PATTERNS.some((re) => re.test(text))) intent = "medical";
  else if (UPLOAD_PATTERNS.some((re) => re.test(text))) intent = "upload";
  else if (needsLiveData || SEARCH_PATTERNS.some((re) => re.test(text))) intent = "search";
  return { intent, needsLiveData, needsMemory: true };
}

/** Enforce strict contract — coerce anything broken back to a safe default. */
export function safeRouter(decision: unknown): RouterDecision {
  const d = (decision ?? {}) as Partial<RouterDecision>;
  const intent = ALLOWED_INTENTS.includes(d.intent as ChatIntent) ? (d.intent as ChatIntent) : "chat";
  return {
    intent,
    needsLiveData: typeof d.needsLiveData === "boolean" ? d.needsLiveData : false,
    needsMemory: typeof d.needsMemory === "boolean" ? d.needsMemory : true,
  };
}

export function routeMessage(lastUserMessage: string): RouterDecision {
  try {
    return safeRouter(classify(lastUserMessage));
  } catch {
    return safeRouter(null);
  }
}

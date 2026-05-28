// Smart router — strict JSON contract only.
// Returns ONLY: { intent, needsLiveData, needsMemory }. Never prose, never UI text.
// Heuristic + cheap to keep latency low; can be swapped for an LLM classifier later
// without changing the contract.

export type ChatIntent = "chat" | "search" | "upload" | "medical";

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
  /\b(202[4-9]|20[3-9]\d)\b/, // any current/future year
  /\b(what(?:'s| is) happening|what happened)\b/i,
];

const MEDICAL_PATTERNS = [
  /\b(symptom|diagnos|prescription|dosage|mg\b|patient|icd[- ]?10|cpt|medication|treatment plan)\b/i,
];

const UPLOAD_PATTERNS = [
  /\b(this (file|document|pdf|attachment)|the (uploaded|attached) (file|doc|pdf|image))\b/i,
];

const SEARCH_PATTERNS = [
  /\b(search|find|look up|google)\b/i,
];

export function routeMessage(lastUserMessage: string): RouterDecision {
  const text = lastUserMessage ?? "";
  const needsLiveData = LIVE_PATTERNS.some((re) => re.test(text));

  let intent: ChatIntent = "chat";
  if (MEDICAL_PATTERNS.some((re) => re.test(text))) intent = "medical";
  else if (UPLOAD_PATTERNS.some((re) => re.test(text))) intent = "upload";
  else if (needsLiveData || SEARCH_PATTERNS.some((re) => re.test(text))) intent = "search";

  // Memory recall is always useful for chat-style interactions.
  const needsMemory = true;

  return { intent, needsLiveData, needsMemory };
}

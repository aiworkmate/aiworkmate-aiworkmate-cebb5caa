-- Adaptive intelligence: enrich memories with usage signals and add routing learning table

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS frequency integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS usefulness real NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS memories_user_score_idx
  ON public.memories (user_id, pinned DESC, usefulness DESC, frequency DESC, last_used_at DESC);

-- Routing performance log: which (intent, liveUsed) paths perform best per user
CREATE TABLE IF NOT EXISTS public.routing_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  intent text NOT NULL,
  live_used boolean NOT NULL DEFAULT false,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, intent, live_used)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routing_stats TO authenticated;
GRANT ALL ON public.routing_stats TO service_role;

ALTER TABLE public.routing_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own routing stats"
  ON public.routing_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Behavior outcomes: lightweight signal log used to adapt over time
CREATE TABLE IF NOT EXISTS public.response_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  intent text NOT NULL,
  live_used boolean NOT NULL DEFAULT false,
  memory_hits integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  chars integer NOT NULL DEFAULT 0,
  was_fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.response_outcomes TO authenticated;
GRANT ALL ON public.response_outcomes TO service_role;

ALTER TABLE public.response_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own response outcomes"
  ON public.response_outcomes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS response_outcomes_user_idx
  ON public.response_outcomes (user_id, created_at DESC);
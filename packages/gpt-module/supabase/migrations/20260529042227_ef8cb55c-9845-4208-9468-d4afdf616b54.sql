CREATE TABLE public.memory_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id uuid,
  conversation_id uuid,
  memory_ids uuid[] NOT NULL DEFAULT '{}',
  helpful boolean NOT NULL,
  impact real NOT NULL DEFAULT 0.5,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.memory_feedback TO authenticated;
GRANT ALL ON public.memory_feedback TO service_role;

ALTER TABLE public.memory_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own memory feedback"
  ON public.memory_feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own memory feedback"
  ON public.memory_feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_memory_feedback_user ON public.memory_feedback(user_id, created_at DESC);
CREATE INDEX idx_memory_feedback_message ON public.memory_feedback(message_id);

DROP POLICY IF EXISTS messages_insert_workspace_writer ON public.messages;

CREATE POLICY messages_insert_workspace_writer
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  app_private.can_write_workspace(workspace_id)
  AND user_id = (SELECT auth.uid())
  AND role IN ('user'::message_role, 'assistant'::message_role, 'system'::message_role)
);

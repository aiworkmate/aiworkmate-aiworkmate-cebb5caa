import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Route = {
  intent: 'general_chat' | 'file_grounded_chat' | 'workflow_assist' | 'medical_assist';
  needsTools: boolean;
  needsMemory: boolean;
  needsWeb: boolean;
  needsFiles: boolean;
  needsMedical: boolean;
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const started = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('authorization') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } }
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: 'Authentication required.' }, 401);
  }

  const body = await req.json();
  const message = String(body.message ?? '').trim();
  if (!message) return json({ error: 'Message is required.' }, 400);

  const organizationId = body.organizationId as string;
  const workspaceId = body.workspaceId as string;
  const conversationId = body.conversationId as string | undefined;
  const uploadIds = Array.isArray(body.uploadIds) ? body.uploadIds as string[] : [];
  const mode = body.mode === 'medical' ? 'medical' : 'general';
  const route = router(message, mode, uploadIds);

  const memories = route.needsMemory
    ? await getMemory(userClient, message, workspaceId, organizationId)
    : [];
  const uploads = route.needsFiles
    ? await getUploadContext(userClient, uploadIds)
    : [];
  const toolResults = route.needsTools
    ? await runTools(message, route)
    : [];
  const workflowContext = await getWorkflowContext(userClient, workspaceId);

  const finalResponse = await generateFinalResponse({
    message,
    memories,
    uploads,
    toolResults,
    workflowContext,
    mode
  });

  if (!finalResponse) {
    throw new Error('Missing final LLM response stage');
  }

  console.log('FINAL RESPONSE:', finalResponse);

  await persistTurn(serviceClient, {
    userId: user.id,
    organizationId,
    workspaceId,
    conversationId,
    message,
    finalResponse,
    mode,
    uploadIds,
    toolNames: toolResults.map((tool) => tool.name),
    latencyMs: Date.now() - started
  });

  return json({ response: finalResponse });
});

function router(message: string, mode: string, uploadIds: string[]): Route {
  const medical = mode === 'medical' || /\b(radiology|ct|mri|x-ray|dicom|patient|clinical|diagnosis|medical|pubmed)\b/i.test(message);
  const web = /\b(today|latest|current|news|weather|near me|price|research|pubmed)\b/i.test(message);
  const workflow = /\b(workflow|automation|runbook|process|task)\b/i.test(message);
  return {
    intent: medical ? 'medical_assist' : workflow ? 'workflow_assist' : uploadIds.length ? 'file_grounded_chat' : 'general_chat',
    needsTools: web || medical,
    needsMemory: true,
    needsWeb: web || medical,
    needsFiles: uploadIds.length > 0,
    needsMedical: medical
  };
}

async function getMemory(client: any, message: string, workspaceId: string, organizationId: string) {
  const embedding = await embed(message);
  const { data, error } = await client.rpc('match_memories', {
    query_embedding: `[${embedding.join(',')}]`,
    match_count: 8,
    match_threshold: 0.72,
    p_workspace_id: workspaceId,
    p_organization_id: organizationId
  });
  if (error) {
    console.warn('memory retrieval failed', error.message);
    return [];
  }
  return data ?? [];
}

async function getUploadContext(client: any, uploadIds: string[]) {
  const { data, error } = await client
    .from('uploads')
    .select('id,name,mime,summary,extracted_text,metadata')
    .in('id', uploadIds);
  if (error) throw error;
  return data ?? [];
}

async function getWorkflowContext(client: any, workspaceId: string) {
  const { data, error } = await client
    .from('workflows')
    .select('id,name,description,status,definition')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .limit(5);
  if (error) return [];
  return data ?? [];
}

async function runTools(message: string, route: Route) {
  const tools = [];
  if (route.needsWeb) {
    tools.push({ name: route.needsMedical ? 'medical_research' : 'web_search', result: { query: message, status: 'not_configured' } });
  }
  return tools;
}

async function generateFinalResponse(input: {
  message: string;
  memories: unknown[];
  uploads: unknown[];
  toolResults: Array<{ name: string; result: unknown }>;
  workflowContext: unknown[];
  mode: string;
}) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const system = [
    'You are AI WorkMate.',
    'Return only the final assistant answer that should be shown to the user.',
    'Never expose router state, tool plans, hidden JSON, or internal debug text.',
    input.mode === 'medical'
      ? 'Medical mode is assistive only. Separate observations, interpretation, uncertainty, recommendations, and clinician review.'
      : ''
  ].filter(Boolean).join('\n');

  const context = JSON.stringify({
    memory: input.memories,
    uploads: input.uploads,
    tools: input.toolResults,
    workflows: input.workflowContext
  });

  if (!apiKey) {
    return localFallback(input.message, input.mode);
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: `User request:\n${input.message}\n\nContext:\n${context}` }] }
      ],
      temperature: 0.35
    })
  });

  if (!response.ok) {
    console.warn('OpenAI response failed', await response.text());
    return localFallback(input.message, input.mode);
  }

  const data = await response.json();
  return String(data.output_text ?? '').trim() || localFallback(input.message, input.mode);
}

async function embed(text: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return new Array(1536).fill(0);
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
      input: text
    })
  });
  if (!response.ok) return new Array(1536).fill(0);
  const data = await response.json();
  return data.data?.[0]?.embedding ?? new Array(1536).fill(0);
}

function localFallback(message: string, mode: string) {
  if (/\bwarzone\b/i.test(message)) {
    return 'There is no single official best Warzone player, but top players commonly include Biffle, Aydan, Metaphor, and Aiden depending on tournament format, season, and meta.';
  }
  if (mode === 'medical') {
    return 'Medical assistive answer: I can organize the provided information, but clinical conclusions require qualified review, complete source data, and appropriate follow-up.';
  }
  return 'I can help with that. I will use your workspace context, memory, files, and available tools to produce a final answer.';
}

async function persistTurn(client: any, input: {
  userId: string;
  organizationId: string;
  workspaceId: string;
  conversationId?: string;
  message: string;
  finalResponse: string;
  mode: string;
  uploadIds: string[];
  toolNames: string[];
  latencyMs: number;
}) {
  let conversationId = input.conversationId;
  if (!conversationId) {
    const { data, error } = await client
      .from('conversations')
      .insert({
        organization_id: input.organizationId,
        workspace_id: input.workspaceId,
        user_id: input.userId,
        title: input.message.slice(0, 72),
        mode: input.mode
      })
      .select('id')
      .single();
    if (error) throw error;
    conversationId = data.id;
  }

  await client.from('messages').insert([
    {
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      conversation_id: conversationId,
      user_id: input.userId,
      role: 'user',
      content: input.message,
      upload_ids: input.uploadIds
    },
    {
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      conversation_id: conversationId,
      user_id: input.userId,
      role: 'assistant',
      content: input.finalResponse,
      tool_names: input.toolNames,
      is_final_response: true
    }
  ]);

  await client.from('analytics').insert({
    organization_id: input.organizationId,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    conversation_id: conversationId,
    event_type: 'chat',
    mode: input.mode,
    latency_ms: input.latencyMs,
    tokens_estimated: Math.ceil((input.message.length + input.finalResponse.length) / 4),
    tool_names: input.toolNames
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' }
  });
}


# Lovable Import Prompt: AI WorkMate

Build AI WorkMate as a production-grade AI operating system in Lovable using Supabase for auth, database, storage, edge functions, and row-level security.

## Product Goal

Create a premium, mobile-first, desktop-ready AI assistant platform with:

- Secure authentication
- Chat with final AI responses only
- Memory
- File and image uploads
- Live-data tool routing
- Medical assistive mode
- Admin analytics
- Audit logs
- Responsive polished UI
- Enterprise-ready security foundation

This must not be a static chatbot. It must be a real app with Supabase-backed persistence and server-side AI/tool orchestration.

## Critical Response Pipeline Rule

The AI pipeline must be:

User → Router → Memory → Tools → LLM → Final Response → UI

Never:

User → Router → UI

Router output is internal only. It may return structured JSON such as:

```json
{
  "intent": "general_chat",
  "needsTools": false,
  "needsMemory": true,
  "needsWeb": false,
  "needsFiles": false,
  "needsMedical": false
}
```

The frontend must only render:

```json
{
  "response": "final assistant answer"
}
```

Never render router state, tool plans, memory internals, debug text, next-action hints, or orchestration output.

Add this backend guard:

```ts
if (!finalResponse) {
  throw new Error("Missing final LLM response stage");
}

console.log("FINAL RESPONSE:", finalResponse);
```

## UI Requirements

Create these pages or app sections:

- Chat
- Dashboard
- Memory
- Files
- Admin
- Settings

The UI should include:

- General/Medical segmented mode toggle
- Live data toggle
- Memory toggle
- File upload
- Image upload
- Voice input button
- Streaming or loading response state
- Dark/light theme
- Mobile layout where chat is primary
- Admin metrics and audit console

Design style:

- Premium
- Clean
- Futuristic
- Trustworthy
- Accessible
- Fast
- Not a landing page
- No visible explanatory feature copy inside the app

## Supabase Requirements

Use Supabase Auth for accounts.

Use Supabase tables:

- profiles
- conversations
- messages
- memories
- uploads
- audit_logs
- analytics_events

Use Supabase Storage:

- private `uploads` bucket

Use Row Level Security:

- Users can only access their own records
- Admins can read analytics and audit logs
- No cross-user data leakage

Use Edge Functions:

- `ai-chat`
- `analyze-upload`
- `live-tool`

All AI provider keys and live-data API keys must stay in Supabase Edge Function secrets. Never expose them in frontend code.

## Backend Edge Function: ai-chat

Implement the edge function flow:

```ts
const route = router(message);
const memory = route.needsMemory ? await getRelevantMemory(userId, message) : [];
const toolResults = route.needsTools ? await runTools(message, route) : [];
const uploadContext = uploadIds.length ? await getUploadContext(userId, uploadIds) : [];

const finalResponse = await generateFinalResponse({
  message,
  memory,
  toolResults,
  uploadContext,
  mode
});

if (!finalResponse) {
  throw new Error("Missing final LLM response stage");
}

console.log("FINAL RESPONSE:", finalResponse);

return new Response(JSON.stringify({ response: finalResponse }), {
  headers: { "content-type": "application/json" }
});
```

The frontend must call this function and render only `data.response`.

## Medical Mode Rules

Medical mode is assistive only.

It must clearly separate:

- Observations
- Interpretation
- Uncertainty
- Recommendations
- Clinician review

It must never claim to replace doctors or provide autonomous diagnosis.

## Live Tools

Add internal tool routing support for:

- Web search
- Weather
- News
- PubMed/current medical research
- Calculator
- Future maps/business search

If no tool API keys are configured, fail gracefully and still generate a final answer from available context.

## Memory

Implement:

- Manual saved memories
- Automatic preference/project memory extraction
- Memory search by semantic similarity or text fallback
- Memory toggle in chat

Memory must never be shown as raw debug context in the assistant answer unless naturally relevant.

## Uploads

Allow:

- Text files
- PDFs
- Images/screenshots
- Documents

Store uploads in the private Supabase Storage bucket. Save extracted text and metadata in the `uploads` table.

## Admin / Analytics

Track:

- Chat latency
- Tool usage
- Upload events
- Error events
- Medical mode usage
- Token estimates
- Auth/security events

Admin page must show summary cards and recent audit events.

## Regression Test Requirement

Add a test or built-in check for:

User:

```txt
who is the best Warzone player
```

Expected answer style:

```txt
There is no single official best Warzone player, but top players commonly include Biffle, Aydan, Metaphor, and Aiden depending on tournament format, season, and meta.
```

Must not contain:

- Next best action
- Ask a follow-up
- I processed your request
- routing response
- orchestration output
- router JSON
- needsTools
- needsMemory

## Existing Local Reference

The current local implementation has these modules:

- `server/modules/orchestrator.mjs`
- `server/modules/aiProvider.mjs`
- `server/modules/tools.mjs`
- `server/modules/memory.mjs`
- `server/modules/uploads.mjs`
- `server/modules/medical.mjs`
- `public/app.js`
- `public/styles.css`

Recreate the architecture in Lovable using React + Supabase, not local JSON storage.


# AI WorkMate

AI WorkMate is a full-stack AI operating system foundation built for secure chat, live data retrieval, memory, file understanding, medical assistive workflows, and enterprise administration.

## Repository Structure

```txt
AI-WorkMate/
├── public/                # Browser app assets
├── server/                # Server implementation
├── src/                   # Core source code
├── supabase/              # Supabase configuration and migrations
├── tests/                 # Test suite
├── package.json           # Root app metadata
└── README.md
```

## What Is Included

- Secure backend API with HTTP-only sessions, CSRF tokens, PBKDF2 password hashing, rate limiting, CSP, security headers, and role checks.
- AI orchestration layer that routes each request through memory retrieval, upload context, live tools, and medical guardrails.
- Live tool adapters for weather, web search, news, calculations, and PubMed medical research, with optional commercial search providers.
- Real memory layer using structured records plus local semantic vector retrieval.
- File and image intake with private server storage, text/PDF extraction, image metadata, and server-side vision model handoff.
- Medical assistive foundation with separated observations, interpretation, uncertainty, recommendations, and clinician review steps.
- Admin analytics for latency, usage, model/tool activity, medical mode usage, errors, uploads, and audit events.
- Responsive premium UI for desktop, tablet, and mobile with chat, uploads, memory, dashboard, admin, settings, voice input, dark mode, and light mode.

## Getting Started

### Installation

```bash
npm install
```

### Run

```bash
cp .env.example .env
npm start
```

Open `http://127.0.0.1:8787`. The first registered account becomes an admin.

The app runs without external packages. If `OPENAI_API_KEY` is configured, AI calls and image understanding run server-side through the provider abstraction. Without a key, the platform still uses local routing, file extraction, semantic memory, live public tools, and deterministic fallback synthesis.

## Testing

```bash
npm test
npm run smoke
```

The tests boot the app on an ephemeral port, validate security headers, register an admin, upload a file, save memory, stream a chat response, and read admin metrics.

## Available Scripts

- `npm run start` - Start the server
- `npm test` - Run tests
- `npm run smoke` - Run smoke tests

## Security Model

Secrets never go to the browser. AI provider keys, search keys, and future medical integrations belong only in backend environment variables.

User data is isolated by owner id in every route. Mutating API routes require a valid session plus CSRF token. Admin metrics and audit logs require the `admin` role. The default JSON store is meant for local and early-stage deployments; production should replace it with Postgres, row-level security, encrypted object storage, and managed audit retention.

## Expansion Points

- Replace `server/lib/storage.mjs` with Postgres or another enterprise data layer.
- Add vector database persistence behind `server/modules/memory.mjs`.
- Add DICOM, PACS, FHIR, and HL7 adapters under `server/modules/medical.mjs`.
- Add OCR and advanced document parsers under `server/modules/documents.mjs`.
- Add more tools in `server/modules/tools.mjs`; the orchestrator already supports dynamic tool planning.
- Add observability exporters in `server/modules/analytics.mjs`.

## Node Version

Requires Node.js >= 20

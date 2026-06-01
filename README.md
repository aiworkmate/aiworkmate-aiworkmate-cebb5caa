# AI WorkMate - Unified Monorepo

AI WorkMate is a full-stack AI operating system foundation built for secure chat, live data retrieval, memory, file understanding, medical assistive workflows, and enterprise administration.

## Repository Structure

This is a unified monorepo consolidating four repositories:

```
AI-WorkMate/
├── packages/
│   ├── nexus-ui/          # UI component library (from workmate-nexus-ui)
│   │                      # TypeScript, 96.7%
│   ├── gpt-module/        # GPT integration module (from aiworkmategpt)
│   │                      # TypeScript, 96.3%
│   └── frontend/          # Frontend application (from ai-workmate-frontend)
│                          # TypeScript, 95.9%
├── src/                   # Core source code
├── server/                # Server implementation
├── supabase/              # Supabase configuration
├── tests/                 # Test suite
├── package.json           # Monorepo root
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

The app runs without external packages. If `OPENAI_API_KEY` is configured, AI calls and image understanding run server-side through the provider abstraction. Without a key, the platform still works with local models.

## Development

Run all packages in development mode:

```bash
npm run dev
```

Or run individual packages:

```bash
npm run dev -w packages/nexus-ui
npm run dev -w packages/gpt-module
npm run dev -w packages/frontend
```

## Building

Build all packages:

```bash
npm run build
```

Build individual packages:

```bash
npm run build:nexus
npm run build:gpt
npm run build:frontend
```

## Testing

```bash
npm test
npm run smoke
```

The tests boot the app on an ephemeral port, validate security headers, register an admin, upload a file, save memory, stream a chat response, and read admin metrics.

## Available Scripts

- `npm run dev` - Start all packages in development mode
- `npm run build` - Build all packages
- `npm run build:nexus` - Build nexus-ui only
- `npm run build:gpt` - Build gpt-module only
- `npm run build:frontend` - Build frontend only
- `npm run start` - Start the server
- `npm test` - Run tests
- `npm run smoke` - Run smoke tests
- `npm run lint` - Lint all packages
- `npm run format` - Format all packages

## Security Model

Secrets never go to the browser. AI provider keys, search keys, and future medical integrations belong only in backend environment variables.

User data is isolated by owner id in every route. Mutating API routes require a valid session plus CSRF token. Admin metrics and audit logs require the `admin` role.

## Expansion Points

- Replace `server/lib/storage.mjs` with Postgres or another enterprise data layer.
- Add vector database persistence behind `server/modules/memory.mjs`.
- Add DICOM, PACS, FHIR, and HL7 adapters under `server/modules/medical.mjs`.
- Add OCR and advanced document parsers under `server/modules/documents.mjs`.
- Add more tools in `server/modules/tools.mjs`; the orchestrator already supports dynamic tool planning.
- Add observability exporters in `server/modules/analytics.mjs`.

## Consolidated Repositories

This monorepo consolidates:

- **workmate-nexus-ui** → `packages/nexus-ui/`
- **aiworkmategpt** → `packages/gpt-module/`
- **ai-workmate-frontend** → `packages/frontend/`
- **AI-WorkMate** → Root files (server, src, supabase, tests)

See [MONOREPO_SETUP.md](./MONOREPO_SETUP.md) for detailed consolidation instructions.

## Node Version

Requires Node.js >= 20

## License

See individual package directories for license information.

# AI Code Review Assistant

> AI-powered code review that evaluates changes against the existing repository's architecture and coding patterns — not just in isolation.

Most "AI code review" tools send a diff to an LLM and get generic comments back: naming nits, a missing null check, maybe a security smell. That's useful, but it misses the question a senior reviewer actually asks first:

> **Does this new code belong in this codebase?**

This project connects to a real GitHub repository, **analyzes its actual architecture** (layering, conventions, existing patterns — derived from evidence, never assumed), and then reviews a branch's diff against that architecture as well as for ordinary bugs, security issues, and quality problems.

## Why this is different

| Typical AI code reviewer | This project |
|---|---|
| Reviews the diff in isolation | Reviews the diff *and* whether it fits the existing architecture |
| Assumes a framework's "usual" pattern | Derives patterns from evidence in the repo (or says it can't tell) |
| Free-form comments | Structured JSON: severity, category, file/line, reason, suggestion |
| Sends whole files / whole repo to the LLM | Builds a bounded, relevant context (diff + a handful of related files) under a token budget |
| No cost visibility | Every review logs input/output tokens and an estimated cost |

## Example review output

```json
{
  "summary": "The branch introduces payment functionality but contains architectural inconsistencies.",
  "score": 78,
  "architecture_score": 65,
  "security_score": 90,
  "quality_score": 80,
  "issues": [
    {
      "severity": "high",
      "category": "architecture",
      "file": "app/Http/Controllers/PaymentController.php",
      "line": 45,
      "title": "Business logic inside controller",
      "message": "The controller contains business logic that should be handled by a service.",
      "reason": "Existing project architecture uses Controller -> Service -> Repository.",
      "suggestion": "Move payment processing logic to PaymentService."
    }
  ]
}
```

## How it works

```text
Login with GitHub
      |
Select repository -> base branch -> feature branch
      |
Click "Start Review"  ---->  Review queued (BullMQ), request returns immediately
                                    |
                              Worker picks up the job
                                    |
                    Analyze repository architecture (cached by commit SHA)
                                    |
                    Fetch branch diff + select relevant existing files
                                    |
                    Build a bounded context (token-budgeted)
                                    |
                    Send structured prompt to OpenAI (JSON-schema output)
                                    |
                    Validate + parse the structured response
                                    |
                    Persist scores, issues, changed files, token usage
                                    |
                              Status = completed
                                    |
                          Review dashboard (polls until done)
```

### GitHub integration

A dedicated `GithubService` (`apps/api/src/modules/github`) wraps Octokit — no other module talks to GitHub directly. OAuth uses the standard Authorization Code flow; the resulting access token is encrypted at rest (AES-256-GCM) and **never sent to the frontend**. The web app authenticates via an httpOnly session cookie issued by the API.

### Architecture analysis

`apps/api/src/modules/analyzer` fetches a repository's file tree once (via a single recursive Git Trees API call) and runs a set of small, independent heuristic detectors:

- **Language** — extension histogram, ignoring vendored/build directories.
- **Framework** — parsed from manifest files (`package.json`, `composer.json`, `requirements.txt`, `go.mod`, `Gemfile`, ...), never guessed from file names alone.
- **Package manager** — lockfile presence.
- **Patterns** — directory/filename evidence for Controllers, Services, Repositories, Models, DTOs, Validators, Jobs, Events, Middleware, API Resources — each result carries the evidence paths that justified it.
- **Conventions** — testing framework, testing directories, dominant file-naming style.

These combine into a **layering inference** (e.g. `Controller -> Service -> Repository -> Model`) and a **confidence score** (`low` / `medium` / `high`). When evidence is thin, the AI is explicitly told not to assert an architecture with confidence — this is enforced in the system prompt, not just a suggestion. Results are cached per `(repository, commit SHA)` so re-reviewing against the same base commit doesn't re-analyze.

### Context building (token cost control)

The entire repository is never sent to the model. `apps/api/src/modules/context-builder` assembles:

- the architecture summary (a few hundred tokens, not raw file dumps),
- the changed files' diffs (capped, exclusion patterns applied),
- a small set of **relevant existing files** — same-directory siblings and same-component files across layers (e.g. `PaymentService` when `PaymentController` changed) — truncated per-file and dropped first if the token budget is exceeded.

Every review logs `inputTokens`, `outputTokens`, `estimatedCostUsd`, and the model used.

### AI review engine

`apps/api/src/modules/ai-review` calls OpenAI with `response_format: json_schema` (structured outputs) and validates the result again with Zod on our side, retrying once with a corrective follow-up if it fails validation. The system prompt encodes explicit rules: never invent files or architecture, only claim what the evidence shows, explain *why* an issue matters, don't report style nits as high severity, and prioritize the **architecture** category above all — see `prompt-builder.ts`.

## Tech stack

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend**: Node.js + TypeScript, Express
- **Database**: PostgreSQL + Prisma
- **Queue**: Redis + BullMQ (separate worker process from the API server)
- **AI**: OpenAI API (structured outputs)
- **GitHub**: OAuth (Authorization Code flow) + REST API via Octokit
- **Testing**: Vitest (unit) + Playwright (E2E, API mocked at the network boundary)
- **CI**: GitHub Actions (lint, typecheck, test, build, E2E)
- **Containerization**: Docker + docker-compose

## Project structure

```text
ai-code-review-assistant/
  apps/
    web/     Next.js app (App Router)
    api/     Express API + BullMQ worker (same codebase, two entrypoints)
  packages/
    types/   Zod schemas + TS types shared by both apps (API DTOs, AI output schema)
    shared/  Small cross-cutting constants/utilities (severity labels, exclusion globs)
    config/  Shared base tsconfig
  prisma/schema.prisma
  docker/    Dockerfiles for api, worker, web
  .github/workflows/ci.yml
```

Each backend concern lives in its own module under `apps/api/src/modules/*` (`auth`, `github`, `repositories`, `analyzer`, `context-builder`, `ai-review`, `reviews`, `settings`) — no giant controller or service file.

## Local setup

### Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis), or your own local instances
- A [GitHub OAuth App](https://github.com/settings/developers) (callback URL: `http://localhost:4000/api/auth/github/callback`)
- An OpenAI API key

### Steps

```bash
git clone <this-repo>
cd ai-code-review-assistant
npm install

cp .env.example .env
# fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OPENAI_API_KEY, TOKEN_ENCRYPTION_KEY
# generate an encryption key with:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker compose up -d postgres redis

npm run prisma:migrate
npm run prisma:generate

npm run dev:api      # API on :4000
npm run dev:worker   # BullMQ worker (separate process)
npm run dev:web      # Next.js on :3000
```

Visit `http://localhost:3000`, log in with GitHub, connect a repository, pick a base and feature branch, and start a review.

### Environment variables

See [`.env.example`](.env.example) for the full list with defaults. The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string (BullMQ) |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key encrypting GitHub tokens at rest |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App credentials |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI credentials and model selection |
| `MAX_CHANGED_FILES`, `MAX_RELEVANT_FILES`, `MAX_FILE_SIZE_KB`, `MAX_CONTEXT_TOKENS` | Token/cost control knobs |
| `DEFAULT_EXCLUDED_PATTERNS` | Seed value for each user's configurable exclusion list (`.env`, `*.pem`, `credentials/*`, ... are always excluded regardless of this setting) |

## Testing

```bash
npm run test          # Vitest unit tests (analyzer detectors, context builder, AI response
                       # parsing, scoring, crypto) — no network/DB access, fully mocked
npm run test:e2e       # Playwright E2E golden path (login -> repo -> branches -> review ->
                       # results), API mocked at the network boundary since real GitHub
                       # OAuth and OpenAI calls can't run in CI
npm run lint
npm run typecheck
npm run build
```

## Docker

```bash
docker compose up --build
```

Brings up Postgres, Redis, the API, the worker, and the web app together. Fill in `.env` first — see above.

## Security notes

- GitHub access tokens are encrypted at rest (AES-256-GCM) and never returned in any API response or written to logs (structured logger redaction covers tokens, secrets, and cookies).
- Sessions are opaque server-side cookies (httpOnly, `SameSite=Lax`), not JWTs holding the GitHub token.
- `.env*`, `*.pem`, `*.key`, `credentials/*`, `secrets/*`, and lockfiles are excluded from both repository analysis and the AI context by default, in addition to any patterns a user configures.
- Mutating requests require a custom header, mitigating CSRF on the cookie-authenticated API; CORS is locked to a single configured frontend origin.
- Review creation (which triggers a paid OpenAI call) has a stricter rate limit than the rest of the API.

## Roadmap (not in this MVP)

The schema and pipeline are deliberately shaped so these can be added without a redesign:

- **AI-assisted fixes**: generate a proposed diff for a flagged issue, show it to the user, and only commit/PR it after explicit approval — never automatic.
- GitLab / Bitbucket support alongside GitHub.
- Slack / email notifications when a review completes.
- Per-repository (not just per-user) review settings.

# Jevslist

[jevslist.com](https://jevslist.com)

A public, anonymous collection of lists, with every list approved and every item validated and ranked by Jev on OpenRouter.

## Product flow

- The home page lists lists and suggests Favorite Tweets, Favorite Models, and Favorite Words when empty.
- New List opens an accessible modal. The name is slugified and checked against D1 while typing. The server rechecks it and enforces a unique index.
- List creation asks Jev one multiple-choice question. Rejections return a useful reason; only an explicit `yes` creates a record.
- Item submission checks normalized text or canonical URL duplicates, reads a public link or X post if present, and checks a content fingerprint.
- Jev first answers a multiple-choice membership question including the list name and description. Only approval triggers a separate preference score call.
- The documented Decisions API returns a score between the numeric indices of its ordered criteria. The two endpoint criteria produce a continuous 0–1 value; the application maps it to 0–1,000 with `round(score * 1000)`. The prompts explicitly define 0 as the least favorite and 1,000 as the absolute favorite of all possible items in the category.
- Items are stored only after both calls succeed, ordered by score descending, with stable creation-time/id tie breaks and pagination.

## Stack

Vinext/React, a Cloudflare Worker, D1, Drizzle schema migrations, and the native OpenRouter Decisions endpoint. Inter is self-hosted under its SIL Open Font License.

API reference: https://openrouter.ai/docs/client-sdks/typescript/sdks/decisions/README
HTTP contract: https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request

## Configuration

Copy `.env.example` to `.env` for local development. Set `OPENROUTER_API_KEY` server-side only. Configure the same value as a secret in Sites before publishing. `SITE_URL` sets OpenRouter attribution; `JEV_DAILY_LIMIT` defaults to 1,000 submission attempts per UTC day. Per-visitor hourly limits are 8 list proposals and 60 item submissions.

Without a key the site remains readable, but creation fails closed with a clear message. There are no fake approvals, score fallbacks, or demo records in production.

New Sites start private. Change this Site’s audience to public for the requested no-login experience when publishing the completed app.

## Development and verification

Use the Sites installation, build, preview, and hosting scripts for this managed checkout. The package manager is pnpm. Database migrations are generated from `db/schema.ts` and are applied by Sites at deployment. Do not seed production through migrations.

Run focused checks from the project directory:

```sh
node tests/core.test.mjs
node tests/content-worker.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The core tests run the real handlers against in-memory SQLite with controlled upstream responses. They cover approval gates, score bounds, duplicates, concurrency, URL safety, request validation, ranking, and rate limits. The extraction test uses the native Worker HTMLRewriter with controlled public-page and X responses. Test data never enters the deployed database.

Browser checks cover list ideas, modal focus, availability checks, submission errors preserving input, and the populated ranking layout. WebMCP actions progressively enhance the same forms when a browser supports `document.modelContext`; the available QA browser does not expose that interface.

## Boundaries

- API credentials never enter client code or browser storage.
- Public link reading accepts HTTP(S), blocks local/IP/private targets, checks DNS and every redirect, and limits bytes and time. Fetched HTML is never executed or rendered as HTML.
- X reading uses its public oEmbed endpoint. Private, deleted, blocked, media-only, or unreadable posts return an actionable error; the user can paste text instead. General links that require login or expose no text are also rejected.
- Database uniqueness and short-lived operation locks handle concurrent duplicate submissions. Short-lived, hashed visitor identifiers support rate limiting.
- All list names, descriptions, handles, submissions, and fetched content are untrusted. Jev prompts instruct it to evaluate them as data, and malformed model responses fail closed.

## Before launch

Provide the OpenRouter key, run live approval/rejection and preference-scoring checks, create the desired initial lists through the real approval flow, and publish with public access. Automated controlled-response tests do not validate live model behavior.

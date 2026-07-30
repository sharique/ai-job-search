# xing-cli

CLI for searching jobs on **Xing.com** (German/DACH job market).

**Data source**: Xing's `/jobs/search` results page and job-detail pages, rendered via a **headless browser**.
**Authentication**: None required.
**Dependencies**: `playwright-core` (runtime dependency — see below). Uses the system's existing Google Chrome/Chromium install rather than downloading a bundled browser.

> **Why a headless browser, unlike every other portal skill here?** Xing's `/jobs/search`
> page ships as an empty React SPA shell — the raw HTML response has zero job data,
> only JS bundle references. The GraphQL/API endpoints that actually hold the data
> (`/graphql/`, `/xas/api/`, `/xing-one/api`) are disallowed by `robots.txt` for every
> agent. A headless browser executing the page's own JS is the only way to read real
> data without calling a disallowed endpoint.

> **Identity note.** Xing's `robots.txt` disallows `/jobs/search/` for the generic
> `User-agent: *` block, but has an explicit exception:
> `User-agent: ClaudeBot / Claude-User / PerplexityBot / Perplexity-User` →
> `Allow: /jobs/search/`. This CLI's browser honestly identifies as `Claude-User`
> (Anthropic's real-time, user-request-driven fetch agent) rather than spoofing an
> ordinary browser — that's what actually unlocks the path Xing opened for it. Keep
> request volume low regardless; this is for personal job search, not bulk collection.

## Installation

```bash
cd .agents/skills/xing-search/cli
bun install
```

Requires Google Chrome or Chromium already installed on the system (checks
`/usr/bin/google-chrome`, `/usr/bin/chromium-browser`, `/usr/bin/chromium`, or the
`CHROME_PATH` env var). No browser is downloaded by this package.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` required) |
| `detail` | Fetch full detail for a single job listing (requires the full URL/path — see below) |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

Each call launches and closes its own browser instance, so expect a few seconds of
latency per call — this is not a persistent/warm process.

## Quick examples

```bash
# Solution Architect roles in Berlin
bun run src/cli.ts search -q "Solution Architect" -l "Berlin" --format table

# Engineering Manager roles, page 2
bun run src/cli.ts search -q "Engineering Manager" --page 2 --format table

# Full detail for one job (path/URL from a search result, not a bare ID)
bun run src/cli.ts detail "/jobs/berlin-solution-architect-123456" --format plain
```

See `../SKILL.md` for the full flag reference and the robots.txt / identity notes.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | **Required.** Job title or keywords, e.g. `"Solution Architect"`. |
| `--location` | `-l` | City/region, e.g. `"Berlin"`. Omit to search all of Germany. |
| `--page` | | 1-indexed page (~20 results/page) — Xing supports this natively via its own `page=` param. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## `detail` requires a full URL/path

Unlike StepStone (where a placeholder slug + the correct trailing ID resolves fine),
Xing's detail URL needs the **exact** slug — a bare numeric ID does not 404 or resolve
to the job; it silently falls through to a keyword-search page instead (confirmed: the
page title becomes `"Current <id> jobs"`). Always pass the `url` field from a `search`
result to `detail`, not just its `id`.

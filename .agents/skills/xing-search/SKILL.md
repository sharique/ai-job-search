---
name: xing-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs on Xing, a major
  German/DACH professional network and job board — for any German city or nationwide.
  Invoke for open positions, vacancies, and hiring across any sector or role. Trigger
  phrases: find a job, job search, search for jobs, job openings, vacancies, hiring,
  positions open, Xing, Stellenangebote, Jobsuche, offene Stellen, "are there any X
  jobs in <German city>".
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/xing-search/cli/src/cli.ts *)
---

# Xing Search Skill

Search live job listings from Xing's `/jobs/search` results for the **German/DACH job
market** (any city, or nationwide). No authentication, no API key.

## ⚠️ Not zero-dependency — uses a headless browser

Every other portal skill in this repo is `bun` + `fetch` + regex, zero runtime
dependencies. This one is different: Xing's `/jobs/search` page is a pure
client-rendered React SPA — the raw HTML response has **no job data at all**, only JS
bundle references. The GraphQL/API endpoints that actually hold the data (`/graphql/`,
`/xas/api/`, `/xing-one/api`) are disallowed by Xing's `robots.txt` for every agent, so
calling them directly is not an option either way. A headless browser (via
`playwright-core`, using the system's already-installed Chrome/Chromium — no browser
download) executing the page's own JS is the only way to read real data.

Practical consequences:
- Requires Google Chrome or Chromium installed on the system (or set `CHROME_PATH`).
- Each `search`/`detail` call launches and closes its own browser — expect a few
  seconds of latency per call, not the near-instant response of the other portal CLIs.
- Keep request volume low: this pattern is meaningfully heavier per-request than a
  plain HTTP fetch, and is intended for personal job search, not bulk collection.

## Identity note

Xing's `robots.txt` disallows `/jobs/search/` for the generic `User-agent: *` block,
but carries an explicit exception:

```
User-agent: ClaudeBot / Claude-User / PerplexityBot / Perplexity-User
Allow: /jobs/search/
```

Since this CLI runs on a user's direct request rather than a bulk background crawl,
the accurate identity is `Claude-User` (Anthropic's real-time, user-request-driven
fetch agent), and the browser's `User-Agent` honestly declares that. This is what
actually unlocks the path Xing deliberately opened for AI agents — not a spoofed
ordinary-browser identity working around a restriction.

## When to use this skill

- Search for job openings on Xing in a German/DACH city or nationwide
- Get the full description of a specific Xing job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/xing-search/cli/src/cli.ts search --query "<title>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — **required.** Job title or keywords, e.g. `"Solution Architect"`.
- `--location <text>` / `-l <text>` — city/region, e.g. `"Berlin"`. Omit to search all of Germany.
- `--page <n>` — 1-indexed page (~20 results/page); Xing supports this natively via its own `page=` param, unlike StepStone.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/xing-search/cli/src/cli.ts detail <url|path> [--format json|plain]
```

**Requires the full URL/path from a `search` result** (e.g. `/jobs/berlin-solution-architect-123456`), not a bare numeric ID — Xing's detail URL needs the exact slug; a bare ID silently falls through to a keyword-search page instead of the job (this CLI rejects bare IDs outright rather than returning that wrong page). Returns the full description, employment type, industry, salary (when listed), posting/expiry dates, and apply link.

## Usage examples

```bash
# Solution Architect roles in Berlin
bun run .agents/skills/xing-search/cli/src/cli.ts search -q "Solution Architect" -l "Berlin" --format table

# Engineering Manager roles, page 2
bun run .agents/skills/xing-search/cli/src/cli.ts search -q "Engineering Manager" --page 2 --format table

# Technical Consultant roles anywhere in Germany
bun run .agents/skills/xing-search/cli/src/cli.ts search -q "Technical Consultant" --format table

# Full detail for a specific job (path/URL from a search result)
bun run .agents/skills/xing-search/cli/src/cli.ts detail "/jobs/berlin-solution-architect-123456" --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing URLs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is read from Xing's rendered `/jobs/search` page and job-detail pages via a
  headless browser — no credentials required.
- Search cards are read directly from the live DOM (`data-testid="job-search-result"`
  articles), not regex-parsed HTML — more robust than the pattern used by the
  zero-dependency portal skills, at the cost of the browser dependency.
- Detail pages embed a clean `schema.org JobPosting` JSON-LD block (title, dates,
  location, employer, salary when listed, full description), parsed directly.
- Pagination is native (`page=` query param) and confirmed working, unlike StepStone.

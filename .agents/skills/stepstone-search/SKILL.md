---
name: stepstone-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs on StepStone, Germany's
  largest general job board — for any German city or nationwide. Invoke for open
  positions, vacancies, and hiring across any sector or role. Trigger phrases: find a
  job, job search, search for jobs, job openings, vacancies, hiring, positions open,
  StepStone, Stellenanzeigen, Stellenangebote, offene Stellen, Jobbörse, "are there
  any X jobs in <German city>".
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/stepstone-search/cli/src/cli.ts *)
---

# StepStone Search Skill

Search live job listings from StepStone's public, server-rendered search-results pages
for the **German job market** (any city, or nationwide). No authentication, no API key,
and **zero runtime dependencies** — it runs with just `bun`.

## robots.txt compliance note

StepStone's `robots.txt` disallows `/search-results`, `/listing`, and any `/jobs/*?...`
query string except a bare `?q=`. This skill only ever requests the plain path form
`/jobs/<query-slug>/in-<location-slug>`, which robots.txt does not restrict — it never
hits a disallowed endpoint. One consequence: StepStone's page 2+ is loaded via
client-side JS and is not reachable through any robots.txt-compliant static URL, so
**only page 1 (~25 results) is available.** If you need more results, narrow the
`--query` or `--location` rather than paging. Keep request volume low regardless.

## When to use this skill

- Search for job openings on StepStone in a German city or nationwide
- Get the full description of a specific StepStone job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/stepstone-search/cli/src/cli.ts search --query "<title>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — **required.** Job title or keywords, e.g. `"Solution Architect"`.
- `--location <text>` / `-l <text>` — city/region, e.g. `"Berlin"`. Omit to search all of Germany.
- `--page <n>` — 1-indexed page. Only page 1 is reachable (see robots.txt note above); page 2+ returns an empty result set with an explicit `meta.warning`.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/stepstone-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job ID from `search` results (e.g. `14293385`). You may also pass a
full StepStone `stellenangebote--...-inline.html` URL. Returns the full description,
employment type, industry, posting/expiry dates, and the listing URL.

## Usage examples

```bash
# Solution Architect roles in Berlin
bun run .agents/skills/stepstone-search/cli/src/cli.ts search -q "Solution Architect" -l "Berlin" --format table

# Engineering Manager roles anywhere in Germany
bun run .agents/skills/stepstone-search/cli/src/cli.ts search -q "Engineering Manager" --format table

# Technical Consultant roles in the DACH region — run per city, StepStone has no multi-city param
bun run .agents/skills/stepstone-search/cli/src/cli.ts search -q "Technical Consultant" -l "Munich" --format table

# Full detail for a specific job
bun run .agents/skills/stepstone-search/cli/src/cli.ts detail 14293385 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from StepStone's public, server-rendered `/jobs/...` results pages and
  `/stellenangebote--...-inline.html` detail pages — no credentials required.
- Search results are parsed via StepStone's own stable `data-at`/`data-testid`
  attributes, not the Emotion-generated CSS class names (which are not stable across
  deploys).
- Detail pages embed a clean `schema.org JobPosting` JSON-LD block, so `detail` parsing
  is exact (title, dates, location, employer, full description) rather than best-effort
  HTML scraping.
- Job IDs are numeric (e.g. `14293385`) — pass them as-is to `detail`; the URL slug text
  before the ID is cosmetic and StepStone resolves by ID alone.
- Page size is fixed at ~25 results (StepStone's default); only page 1 is reachable, see the robots.txt note above.

# stepstone-cli

CLI for searching jobs on **StepStone.de** (German job market).

**Data source**: StepStone's public, server-rendered search-results pages (`/jobs/<query>/in-<location>`) and job-detail pages (`/stellenangebote--...--<id>-inline.html`).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **robots.txt note.** StepStone's `robots.txt` disallows `/search-results`, `/listing`,
> and any `/jobs/*?...` query string except a bare `?q=`. This CLI only ever requests the
> plain path form `/jobs/<query-slug>/in-<location-slug>`, which robots.txt does not
> restrict. Page 2+ of results is loaded client-side via JS and is not reachable through
> any robots.txt-compliant static URL, so only page 1 (~25 results) is available here.
> Keep request volume low and use for personal job search only.

## Installation

```bash
cd .agents/skills/stepstone-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` required) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Solution Architect roles in Berlin
bun run src/cli.ts search -q "Solution Architect" -l "Berlin" --format table

# Engineering Manager roles anywhere in Germany
bun run src/cli.ts search -q "Engineering Manager" --format table

# Full detail for one job
bun run src/cli.ts detail 14293385 --format plain
```

See `../SKILL.md` for the full flag reference and the robots.txt note.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | **Required.** Job title or keywords, e.g. `"Solution Architect"`. |
| `--location` | `-l` | City/region, e.g. `"Berlin"`. Omit to search all of Germany. |
| `--page` | | 1-indexed page. Only page 1 is reachable (see robots.txt note above). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

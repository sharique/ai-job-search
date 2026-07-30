#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Xing.com (German/DACH market). Unlike the
// other portal skills in this repo, this one launches a headless browser (via
// playwright-core against the system's installed Chrome/Chromium) because Xing's
// search-results page is a pure client-rendered SPA with no data in its raw HTML —
// see helpers.ts and SKILL.md for the full explanation.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === undefined) continue
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `xing-cli — search jobs on Xing.com (German/DACH market)

Uses a headless browser (system Chrome/Chromium via playwright-core) — Xing's search
page has no usable data without JS rendering. Slower than the other portal CLIs
(a few seconds per call); keep volume low.

USAGE
  bun run src/cli.ts search --query "<title>" [flags]
  bun run src/cli.ts detail <url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Job title or keywords. REQUIRED. e.g. "Solution Architect".
  --location, -l <text>   City/region, e.g. "Berlin". Omit to search all of Germany.
  --page <n>              1-indexed page (~20 results/page). Supported natively via Xing's own page= param.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "Solution Architect" -l "Berlin" --format table
  bun run src/cli.ts search -q "Engineering Manager" --page 2 --format table
  bun run src/cli.ts detail "/jobs/berlin-solution-architect-123456" --format plain

detail requires the full URL/path from a search result — Xing does not resolve job
postings by bare numeric ID (it silently falls back to a search page instead).
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const query = typeof flags.query === "string" ? flags.query : undefined
    if (!query) {
      process.stderr.write(
        JSON.stringify({ error: 'the --query/-q flag is required (e.g. -q "Solution Architect")', code: "NO_QUERY" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
        return null
      }
      return val
    }

    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      flags.page = String(v)
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }

    const opts: SearchOpts = {
      query,
      location: typeof flags.location === "string" ? flags.location : undefined,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires a <url|path>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"] }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))

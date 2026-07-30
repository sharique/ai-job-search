import { buildSearchUrl, htmlFetch, parseJobCards, parseTotalCount, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query: string
  location?: string
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const date = c.date || "—"
    return `${c.id.padEnd(11)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(11) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(20) + " POSTED"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildSearchUrl(opts.query, opts.location)
    const html = await htmlFetch(url)
    let cards = parseJobCards(html)
    const total = parseTotalCount(html)

    // StepStone's results page is server-rendered for page 1 only (~25 results);
    // page 2+ loads via a client-side "load more" call that isn't reachable through
    // a robots.txt-compliant static URL. We surface that honestly rather than
    // silently returning page-1 results again under a different page number.
    let warning: string | undefined
    if (opts.page > 1) {
      cards = []
      warning =
        "StepStone does not expose page 2+ via a static, robots.txt-compliant URL " +
        "(pagination is client-side). Only page 1 (~25 results) is available; narrow " +
        "--query or --location to get a more specific first page instead."
    }

    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
      if (warning) process.stdout.write(`\nNote: ${warning}\n`)
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map((c) => `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      const meta: Record<string, unknown> = { count: cards.length, page: opts.page, totalAvailable: total }
      if (warning) meta.warning = warning
      process.stdout.write(JSON.stringify({ meta, results: cards }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}

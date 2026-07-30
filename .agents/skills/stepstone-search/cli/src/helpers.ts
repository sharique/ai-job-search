// Data source: StepStone's public server-rendered search-results pages and job-detail
// pages (www.stepstone.de). No authentication required. Search results are parsed via
// stable `data-at`/`data-testid` attributes (StepStone's own test hooks), not the
// hashed Emotion CSS class names, which are not stable across deploys. Detail pages
// embed a clean schema.org JobPosting JSON-LD block, so detail parsing is just JSON.parse.

export const BASE_URL = "https://www.stepstone.de"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  industry: string | null
  datePosted: string | null
  validThrough: string | null
  applyUrl: string | null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Remove <style>/<svg> blocks (Emotion CSS-in-JS + icon markup) before extracting text. */
function stripNoise(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "")
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/**
 * Extract the visible text for a `data-at="<attr>"` field. StepStone nests each
 * field's text several levels deep (icon span, text span, sometimes an inner div),
 * so a naive "up to the first closing tag" match cuts off before the real text. This
 * instead skips past the opening tag that carries the attribute, then reads up to the
 * start of the *next* `data-at="..."` field (which reliably marks the field boundary
 * in StepStone's card markup) before stripping tags.
 */
function fieldText(chunk: string, attr: string): string | null {
  const marker = `data-at="${attr}"`
  const idx = chunk.indexOf(marker)
  if (idx === -1) return null
  let rest = chunk.slice(idx + marker.length)
  const gt = rest.indexOf(">")
  if (gt === -1) return null
  rest = rest.slice(gt + 1, gt + 1 + 1500)
  const nextIdx = rest.search(/data-at="/)
  if (nextIdx !== -1) {
    // Truncate at the start of the tag that carries the next data-at attribute
    // (not at the attribute text itself), otherwise a dangling, never-closed
    // "<span class=..." fragment survives stripTags and leaks into the result.
    const tagStart = rest.lastIndexOf("<", nextIdx)
    rest = rest.slice(0, tagStart === -1 ? nextIdx : tagStart)
  }
  return clean(rest) || null
}

/**
 * Slugify free text into StepStone's URL path style, e.g. "Solution Architect" ->
 * "solution-architect". StepStone accepts plain lowercase hyphenated slugs for both
 * the query and (prefixed with "in-") the location segment.
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Build the robots.txt-compliant search URL: /jobs/<query-slug>[/in-<location-slug>].
 * StepStone's robots.txt disallows /jobs/*?* (except a bare ?q=) and disallows
 * /search-results and /listing entirely, so this skill only uses the plain path form,
 * which robots.txt does not restrict.
 */
export function buildSearchUrl(query: string, location?: string): string {
  const parts = [BASE_URL, "jobs", slugify(query)]
  if (location && location.trim()) parts.push(`in-${slugify(location)}`)
  return parts.join("/")
}

/**
 * Parse the search-results page. Each card is anchored on its detail-page href
 * (`/stellenangebote--...--<id>-inline.html`), which is unique per card and stable
 * across deploys (unlike the Emotion-generated CSS classes). We split on that anchor
 * and parse each chunk independently so one malformed card cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const hrefRe = /href="(\/stellenangebote--[^"]*?--(\d+)-inline\.html)"/g
  const matches = [...html.matchAll(hrefRe)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    if (!match) continue
    const href = match[1]
    const id = match[2]
    if (!href || !id) continue
    // Seen already (StepStone sometimes repeats a card's href in a hidden/duplicate
    // node) — skip repeats so results stay deduplicated.
    if (results.some((r) => r.id === id)) continue

    const chunkEnd = matches[i + 1]?.index ?? Math.min(html.length, match.index! + 6000)
    const chunk = stripNoise(html.slice(match.index!, chunkEnd))

    const titleMatch = chunk.match(/data-at="job-item-title"[\s\S]*?>([\s\S]*?)<\/a>/)
    const title = titleMatch ? clean(titleMatch[1]) : null
    if (!title) continue

    const company = fieldText(chunk, "job-item-company-name")
    const location = fieldText(chunk, "job-item-location")

    const dateMatch = chunk.match(/data-at="job-item-timeago"[\s\S]*?<time[^>]*>([\s\S]*?)<\/time>/)
    const date = dateMatch ? clean(dateMatch[1]) || null : null

    results.push({
      id,
      title,
      company,
      location,
      date,
      url: `${BASE_URL}${decodeHtmlEntities(href)}`,
    })
  }

  return results
}

/**
 * Total result count, from StepStone's own analytics payload embedded in the page.
 * That payload lives inside an HTML attribute value, so its quotes are HTML-entity-
 * encoded (`&#34;searchResultsTotalJobCount&#34;:145`) rather than literal `"` —
 * match both forms.
 */
export function parseTotalCount(html: string): number | null {
  const m = html.match(/(?:"|&#34;)searchResultsTotalJobCount(?:"|&#34;):(\d+)/)
  return m && m[1] ? parseInt(m[1], 10) : null
}

/** Parse the single-job detail page via its schema.org JobPosting JSON-LD block. */
export function parseJobDetail(html: string, id: string, url: string): JobDetail {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  for (const b of blocks) {
    const raw = b[1]
    if (!raw) continue
    try {
      const data = JSON.parse(raw)
      if (data && data["@type"] === "JobPosting") {
        const org = data.hiringOrganization || {}
        const place = data.jobLocation?.address || {}
        const locationParts = [place.addressLocality, place.addressRegion].filter(Boolean)
        const description = data.description
          ? decodeHtmlEntities(stripTags(String(data.description).replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")))
              .replace(/\n{3,}/g, "\n\n")
              .trim() || null
          : null
        return {
          id,
          title: data.title ? clean(String(data.title)) : "(untitled)",
          company: org.name ? clean(String(org.name)) : null,
          location: locationParts.length ? locationParts.join(", ") : null,
          date: data.datePosted ?? null,
          url,
          description,
          employmentType: data.employmentType ?? null,
          industry: data.industry ?? null,
          datePosted: data.datePosted ?? null,
          validThrough: data.validThrough ?? null,
          applyUrl: org.url ?? url,
        }
      }
    } catch {
      continue
    }
  }
  return {
    id,
    title: "(untitled)",
    company: null,
    location: null,
    date: null,
    url,
    description: null,
    employmentType: null,
    industry: null,
    datePosted: null,
    validThrough: null,
    applyUrl: null,
  }
}

/** Extract the numeric job ID from a StepStone detail URL or a bare ID. */
export function idFromInput(input: string): string | null {
  const fromUrl = input.match(/--(\d+)-inline\.html/)
  if (fromUrl) return fromUrl[1] ?? null
  const bare = input.match(/^\d+$/)
  return bare ? input : null
}

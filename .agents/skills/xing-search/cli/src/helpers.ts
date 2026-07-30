import type { Page } from "playwright-core"
import { openSession, closeSession } from "./browser.js"

export const BASE_URL = "https://www.xing.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
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
  salary: string | null
  applyUrl: string | null
}

/** Extract the trailing numeric job ID from a Xing job path, e.g. .../foo-156225861 -> "156225861". */
export function idFromUrl(url: string): string | null {
  const m = url.match(/-(\d+)(?:\?|$)/) || url.match(/\/jobs\/(\d+)(?:\?|$)/)
  return m ? (m[1] ?? null) : null
}

export function buildSearchUrl(query: string, location?: string, page = 1): string {
  const params = new URLSearchParams()
  params.set("keywords", query)
  if (location && location.trim()) params.set("location", location)
  if (page > 1) params.set("page", String(page))
  return `${BASE_URL}/jobs/search?${params.toString()}`
}

/**
 * Runs inside the browser (via page.evaluate): reads the rendered DOM directly rather
 * than serializing HTML and regex-parsing it. Xing's search cards don't carry a
 * data-testid for company/location, so this falls back to a `class*=` substring match
 * on the styled-components class names, which keep their semantic prefix (e.g.
 * "...Company-sc-<hash>") stable across renders even though the hash suffix is
 * per-build and not to be relied on literally.
 */
function extractCardsInPage(): JobCard[] {
  const cards: JobCard[] = []
  const articles = document.querySelectorAll('[data-testid="job-search-result"]')
  articles.forEach((article) => {
    const link = article.querySelector<HTMLAnchorElement>('a[href^="/jobs/"]')
    const href = link?.getAttribute("href") || null
    if (!href) return
    const idMatch = href.match(/-(\d+)(?:\?|$)/) || href.match(/\/jobs\/(\d+)(?:\?|$)/)
    const id = idMatch ? idMatch[1] : null
    if (!id) return

    const titleEl = article.querySelector('[data-testid="job-teaser-list-title"]')
    const title = titleEl?.textContent?.trim() || null
    if (!title) return

    const companyEl = article.querySelector('[class*="Company-sc-"]')
    const company = companyEl?.textContent?.trim() || null

    const locationContainer = article.querySelector('[class*="location-display-styles__Container"]')
    let location: string | null = null
    if (locationContainer) {
      // Strip the "+ N more" overflow label before reading the visible text.
      const overflow = locationContainer.querySelector('[class*="OverflowLabel"]')
      const clone = locationContainer.cloneNode(true) as HTMLElement
      if (overflow) {
        const cloneOverflow = clone.querySelector('[class*="OverflowLabel"]')
        cloneOverflow?.remove()
      }
      location = clone.textContent?.trim() || null
    }

    const timeEl = article.querySelector("time[datetime]")
    const date = timeEl?.getAttribute("datetime") || null

    cards.push({
      id,
      title,
      company,
      location,
      date,
      url: href.startsWith("http") ? href : `${window.location.origin}${href}`,
    })
  })
  return cards
}

export async function searchXing(query: string, location: string | undefined, page: number): Promise<JobCard[]> {
  const session = await openSession()
  try {
    await session.page.goto(buildSearchUrl(query, location, page), {
      waitUntil: "networkidle",
      timeout: 30000,
    })
    await session.page
      .waitForSelector('[data-testid="job-search-result"]', { timeout: 10000 })
      .catch(() => undefined) // page may legitimately have zero results
    return await session.page.evaluate(extractCardsInPage)
  } finally {
    await closeSession(session)
  }
}

/** Strip a leading standalone "null" line — a known rendering artifact in Xing's own description HTML. */
function cleanDescription(text: string): string {
  return text.replace(/^\s*null\s*\n/, "").trim()
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

/**
 * Strip tags while preserving the `\n` paragraph breaks inserted by the caller (only
 * horizontal whitespace is collapsed). A plain `\s+` -> " " collapse here would
 * destroy those breaks before `cleanDescription`'s leading-"null" check ever runs.
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
}

/**
 * Parse a schema.org JobPosting object (already JSON.parsed) into a JobDetail. Pure
 * function — no browser required — so it is directly unit-testable.
 */
export function jobPostingToDetail(data: Record<string, unknown>, id: string, url: string): JobDetail {
  const org = (data.hiringOrganization as Record<string, unknown>) || {}
  const locations = Array.isArray(data.jobLocation) ? data.jobLocation : data.jobLocation ? [data.jobLocation] : []
  const firstLocation = (locations[0] as Record<string, unknown>) || {}
  const address = (firstLocation.address as Record<string, unknown>) || {}
  const locationParts = [address.addressLocality, address.addressRegion].filter(
    (v, i, arr) => typeof v === "string" && v && arr.indexOf(v) === i,
  )

  let description: string | null = null
  if (typeof data.description === "string") {
    const withBreaks = data.description
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    description = cleanDescription(decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n")) || null
  }

  let salary: string | null = null
  const baseSalary = data.baseSalary as Record<string, unknown> | undefined
  if (baseSalary && typeof baseSalary === "object") {
    const value = baseSalary.value as Record<string, unknown> | undefined
    if (value && typeof value.minValue === "number" && typeof value.maxValue === "number") {
      const currency = typeof baseSalary.currency === "string" ? baseSalary.currency : ""
      salary = `${value.minValue.toLocaleString()}-${value.maxValue.toLocaleString()} ${currency}`.trim()
    }
  }

  return {
    id,
    title: typeof data.title === "string" ? decodeHtmlEntities(data.title) : "(untitled)",
    company: typeof org.name === "string" ? org.name : null,
    location: locationParts.length ? (locationParts as string[]).join(", ") : null,
    date: typeof data.datePosted === "string" ? data.datePosted : null,
    url,
    description,
    employmentType: typeof data.employmentType === "string" ? data.employmentType : null,
    industry: typeof data.industry === "string" ? data.industry : null,
    datePosted: typeof data.datePosted === "string" ? data.datePosted : null,
    validThrough: typeof data.validThrough === "string" ? data.validThrough : null,
    salary,
    applyUrl: typeof org.url === "string" ? org.url : url,
  }
}

function emptyDetail(id: string, url: string): JobDetail {
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
    salary: null,
    applyUrl: null,
  }
}

async function extractLdJsonInPage(): Promise<Record<string, unknown> | null> {
  const script = document.querySelector('script[type="application/ld+json"]')
  if (!script?.textContent) return null
  try {
    const data = JSON.parse(script.textContent)
    return data && data["@type"] === "JobPosting" ? data : null
  } catch {
    return null
  }
}

export async function fetchXingDetail(url: string): Promise<{ status: number; detail: JobDetail | null }> {
  const id = idFromUrl(url) ?? "unknown"
  const session = await openSession()
  try {
    const response = await session.page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
    const status = response?.status() ?? 0
    if (status === 410 || status === 404) return { status, detail: null }
    await session.page
      .waitForSelector('script[type="application/ld+json"]', { timeout: 10000 })
      .catch(() => undefined)
    const data = (await session.page.evaluate(extractLdJsonInPage as unknown as () => Promise<Record<string, unknown> | null>)) as
      | Record<string, unknown>
      | null
    if (!data) return { status, detail: emptyDetail(id, url) }
    return { status, detail: jobPostingToDetail(data, id, url) }
  } finally {
    await closeSession(session)
  }
}

/** Pure helper for testing extractCardsInPage's data-shaping logic without a live browser. */
export const __internal = { extractCardsInPage }

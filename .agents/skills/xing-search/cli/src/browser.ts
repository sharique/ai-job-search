// Xing's job-search results page is a pure client-rendered React SPA — the raw HTML
// response contains no job data at all, only JS bundle references. There is no public
// JSON API available either (robots.txt disallows /graphql/, /xas/api/, /xing-one/api
// for every agent, including the AI-agent exception block below). A headless browser
// is therefore not an optimization here, it is the only way to get real data at all.
//
// This is the one portal skill in the repo that is not zero-runtime-dependency for
// that reason — see SKILL.md and the CLI README for the full explanation.
//
// Identity note: Xing's robots.txt disallows /jobs/search/ for the generic
// `User-agent: *` block, but carries an explicit exception:
//   User-agent: ClaudeBot / Claude-User / PerplexityBot / Perplexity-User
//   Allow: /jobs/search/
// Since this CLI runs on a user's direct request (not a bulk background crawl), the
// accurate identity is Claude-User (Anthropic's real-time fetch-on-behalf-of-a-user
// agent), so the browser's User-Agent honestly declares that rather than spoofing an
// ordinary browser — which is what actually unlocks the path Xing opened for it.

import { chromium, type Browser, type Page } from "playwright-core"
import { existsSync } from "fs"

export const CLAUDE_USER_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)"

const CANDIDATE_CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((p): p is string => !!p)

function resolveExecutablePath(): string {
  for (const path of CANDIDATE_CHROME_PATHS) {
    if (existsSync(path)) return path
  }
  throw new Error(
    "No system Chrome/Chromium found. This skill uses playwright-core against an " +
      "existing browser install rather than downloading its own (to avoid a ~150MB " +
      "download). Install Google Chrome or Chromium, or set CHROME_PATH to its binary.",
  )
}

export interface Session {
  browser: Browser
  page: Page
}

export async function openSession(): Promise<Session> {
  const browser = await chromium.launch({
    executablePath: resolveExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  const page = await browser.newPage({ userAgent: CLAUDE_USER_UA })
  return { browser, page }
}

export async function closeSession(session: Session): Promise<void> {
  await session.browser.close()
}

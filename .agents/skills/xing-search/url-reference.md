# Xing.com URL Reference

Rendered (headless-browser) pages used by this skill. German/DACH market.

## robots.txt (fetched 2026-07-18)

Relevant rules from `https://www.xing.com/robots.txt`:

```
User-agent: *
Disallow: /jobs/search/
Disallow: /jobs/search?*
Disallow: /graphql/
Disallow: /xas/api/
Disallow: /xing-one/api
Disallow: /graphql/api
...

User-agent: GPTBot
User-agent: GPTUser
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
Allow: /jobs/search/
Allow: /jobs/search?*
Disallow: /graphql/
Disallow: /xas/api/
Disallow: /xing-one/api
Disallow: /graphql/api
```

**Implication:** `/jobs/search` is disallowed for ordinary crawlers/browsers but
explicitly `Allow`ed for a named group of AI agents that includes `ClaudeBot` and
`Claude-User`. This skill's browser sends a `Claude-User` User-Agent (see `browser.ts`)
to honestly claim that identity — this is what permits the search request, not UA
spoofing. The GraphQL/API endpoints are disallowed for **every** identity, including
this exception block, which is why this skill renders the page rather than calling an
API directly (there is no compliant API path at all).

## Why a headless browser is required

Fetching `/jobs/search?keywords=...` with a plain HTTP client returns ~412KB of HTML
containing **zero job data** — only `<link rel="modulepreload">` references to hashed
JS chunk files (`job-teaser-list-item-*.js`, `search-*.js`, etc.) and no
`__NEXT_DATA__`, `__INITIAL_STATE__`, or `application/ld+json` blocks. The page is a
pure client-rendered React SPA. Confirmed via direct comparison: the same URL fetched
with `curl` vs. rendered with a headless browser produces completely different content
(the browser version shows real listings like "195 jobs found" with real company
names).

## Search

```
GET https://www.xing.com/jobs/search?keywords=<query>&location=<location>&page=<n>
```

- `keywords`: free-text query (URL-encoded).
- `location`: optional city/region (URL-encoded). Omit to search all of Germany.
- `page`: 1-indexed; omitted for page 1. **Confirmed working** via direct navigation
  (page 2 returns a different first result than page 1) — no scrolling or "Show more"
  button interaction needed, unlike what the visible "Show more" button on the page
  might suggest.

After rendering (`waitUntil: "networkidle"`, then `waitForSelector` on the first
result card, ~2-4s typical), each result is a:

```html
<article data-testid="job-search-result" aria-label="<TITLE>. Click to open the full description in a new tab">
  <a href="/jobs/<slug>-<id>" target="_blank" ...></a>
  ...
  <h2 data-testid="job-teaser-list-title">TITLE</h2>
  <p class="...Company-sc-<hash>...">COMPANY</p>
  <div class="...location-display-styles__Container...">
    <p>LOCATION<b class="...OverflowLabel...">&nbsp;+ N more</b></p>
  </div>
  ...
  <span>Full-time</span><span>€X – €Y</span>  <!-- employment type + salary, when listed -->
  <time datetime="2026-07-10T11:16:16Z">7 days ago</time>
</article>
```

Extraction happens **in-page** via `page.evaluate()` reading the live DOM directly
(`extractCardsInPage` in `helpers.ts`) rather than serializing HTML and regex-parsing
it — this avoids the tag-nesting/dangling-tag fragility that regex parsing hit on
StepStone's markup. `data-testid` values are Xing's own test hooks and are the most
stable anchors available; company/location fall back to a `[class*="..."]` substring
match on the styled-components class name's semantic prefix (e.g. `Company-sc-`),
since no `data-testid` exists for those two fields specifically. The hash suffix on
those classes is per-build and not relied on — only the substring is matched.

~20-21 results render per page (confirmed count: 21 `job-search-result` articles on a
195-result query's first page).

## Detail

```
GET https://www.xing.com/jobs/<slug>-<id>
```

**The slug must be exact.** Verified two failure modes when it isn't:
- Wrong slug, correct trailing ID (e.g. `/jobs/x-156225861`): **HTTP 410 Gone**.
- Bare ID with no slug at all (e.g. `/jobs/156225861`): **HTTP 200**, but Xing silently
  redirects the *keyword search* to treat the ID as a search term instead
  (`/jobs/156225861?keywords=156225861`, page title `"Current 156225861 jobs - ..."`).
  This is a silent-failure trap — a naive "just try the ID" implementation would return
  a search-results page dressed up as if it were the job detail. `detail.ts` rejects
  bare numeric IDs outright for this reason; callers must pass the exact path/URL from
  a `search` result.

Once rendered, the detail page embeds a clean `<script type="application/ld+json">`
`JobPosting` block:

```json
{
  "@type": "JobPosting",
  "title": "...",
  "description": "...HTML, with a spurious literal \"null\" line near the top (a Xing rendering artifact, stripped by cleanDescription)...",
  "datePosted": "2026-07-10T11:16:16Z",
  "validThrough": "2026-09-08T11:19:18Z",
  "employmentType": "Full-time",
  "industry": "Other industries",
  "hiringOrganization": { "name": "...", "url": "...", "logo": "..." },
  "baseSalary": { "@type": "MonetaryAmount", "currency": "EUR", "value": { "@type": "QuantitativeValue", "minValue": 70000, "maxValue": 100000, "unitText": "YEAR" } },
  "jobLocation": [{ "@type": "Place", "address": { "addressLocality": "...", "addressRegion": "...", "postalCode": "...", "addressCountry": "DE" } }]
}
```

Note `jobLocation` is an **array** here (StepStone's is a bare object) — `jobPostingToDetail` in `helpers.ts` handles both shapes defensively. `baseSalary` is present when the posting lists a salary range; formatted into a readable string in `JobDetail.salary`.

## Notes

- No authentication required for either page.
- German/DACH market. Query/location text is typically German.
- Each `search`/`detail` invocation opens and closes its own browser process
  (`browser.ts`); there is no persistent/warm browser across calls, so expect
  multi-second latency per call — budget accordingly for `/scrape` runs across many
  queries.
- Chrome/Chromium executable is resolved from (in order): `CHROME_PATH` env var,
  `/usr/bin/google-chrome`, `/usr/bin/google-chrome-stable`,
  `/usr/bin/chromium-browser`, `/usr/bin/chromium`, the macOS Chrome app path. Throws a
  clear error if none exist rather than attempting to download one.

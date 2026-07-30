# Search Queries for Job Scraper

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`. This fork also adds `stepstone-search` and `xing-search` (both German market). Danish demo skills (`jobbank-search`, `jobdanmark-search`, `jobindex-search`, `jobnet-search`) are also installed but not relevant to this candidate's Germany/EU/Gulf search - ignore their results.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Indeed.de was evaluated via `/add-portal` and deliberately not scaffolded as a CLI:** robots.txt explicitly names AI crawlers (ClaudeBot, anthropic-ai, GPTBot, etc.) and disallows `/jobs` search for that group specifically; `/viewjob` detail pages are disallowed for everyone. Use `site:indeed.de/de` WebSearch queries instead.

**Xing was initially skipped, then built with a headless browser on a follow-up `/add-portal` run.** Its `robots.txt` actually *allows* `/jobs/search` for Claude-User specifically (an explicit AI-agent exception), but the page is a pure client-rendered SPA with no data in the raw HTML. `xing-search` renders it via a headless browser (system Chrome, `playwright-core`) rather than calling the GraphQL/API endpoints, which remain disallowed for every agent. Expect a few seconds of latency per call - it is not zero-dependency like the other portal CLIs.

## Search Sites

Primary:
- **linkedin.com/jobs** - filter: Germany / Berlin, DACH, EU, Arab Gulf; also covered by `linkedin-search` CLI
- **stepstone.de** - Germany's largest general job board; covered by `stepstone-search` CLI (search + detail). Note: only page 1 (~25 results) is reachable per-query — StepStone's own robots.txt blocks query-string pagination — so narrow `--query`/`--location` rather than paging.
- **xing.com/jobs** - major German/DACH professional network and job board; covered by `xing-search` CLI (search + detail, native `page=` pagination). Slower per-call than the other CLIs (headless browser).
- **indeed.de** - WebSearch fallback only (see note above)
- Company career pages directly (Bayer, Takeda, Pfizer, Boehringer Ingelheim, EY, NTT Data, Capgemini, and other large consultancies/enterprises)

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies

## Candidate Summary (for query context)

Solution Architect / Engineering Manager / Technical Consultant background: 20+ years enterprise software delivery (PHP, Drupal, Symfony, AWS), team leadership (built teams up to 5 engineers from scratch), regulated-environment delivery (pharma, healthcare). Currently exploring four directions in parallel — Solution Architect/consulting, Technical Consultant & PM, Engineering Manager/Tech Lead, and hands-on backend engineering (including a Go pivot). Berlin-based, EU Blue Card, open to DACH/wider EU relocation and the Arab Gulf region for the right role.

## Query Categories

Queries are grouped by priority. Each query should be combined with location terms where the site supports it.

### Priority 1: Solution Architect / Digital Transformation

These match the strongest and most established career direction.

```
site:linkedin.com/jobs "Solution Architect" Berlin OR Germany
site:linkedin.com/jobs "Digital Transformation Architect" Germany
site:linkedin.com/jobs "Enterprise Architect" Drupal OR PHP Germany
site:indeed.de/de "Solution Architect" Berlin
site:xing.com/jobs "Solution Architect" Berlin
"Solution Architect" AWS Drupal Berlin
```

### Priority 2: Technical Consultant / Project Manager

Consulting-track roles matching the RFP/client-delivery background from Capgemini and the EY/NTT Data applications.

```
site:linkedin.com/jobs "Technical Consultant" Germany
site:linkedin.com/jobs "Senior Consultant" enterprise platform Berlin
site:indeed.de/de "Technical Consultant" Germany
"Technical Project Manager" Drupal OR PHP OR AWS Germany
```

### Priority 3: Engineering Manager / Tech Lead

People-leadership track, matching the team-building experience at bbg bitbase and the Wikimedia Deutschland application.

```
site:linkedin.com/jobs "Engineering Manager" Berlin OR Germany
site:linkedin.com/jobs "Technical Lead" OR "Team Lead" PHP Berlin
"Head of Engineering" Berlin OR Germany
```

### Priority 4: Hands-on Software / Cloud / Platform Engineer

Broader net for IC roles, including the Go pivot explored via the Tesla application.

```
site:linkedin.com/jobs "Software Engineer" Go OR Golang Berlin
site:linkedin.com/jobs "Cloud Engineer" OR "Platform Engineer" AWS Germany
site:linkedin.com/jobs "DevOps Engineer" GitLab OR Terraform Berlin
```

### Wider region net

```
site:linkedin.com/jobs "Solution Architect" OR "Engineering Manager" DACH
site:linkedin.com/jobs "Solution Architect" Netherlands OR Luxembourg
site:linkedin.com/jobs "Technical Consultant" OR "Solution Architect" UAE OR Saudi Arabia OR Qatar
```

## Location Filter

When evaluating results, use these tiers:
- **Ideal:** Berlin, Germany (current base)
- **Acceptable:** DACH region (Germany, Austria, Switzerland); remote-friendly roles based in Germany
- **Borderline:** Wider EU with relocation support (e.g. Luxembourg, Netherlands) — already demonstrated via the EY Luxembourg application
- **Too far / case-by-case:** Arab Gulf region (UAE, Saudi Arabia, Qatar, etc.) — open to this only "for the right opportunity," not a general search target; weight lower than EU results unless the role is a strong fit

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries

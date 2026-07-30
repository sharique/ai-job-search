import { describe, test, expect } from "bun:test";
import { parseJobCards, parseJobDetail, parseTotalCount, buildSearchUrl, slugify, idFromInput } from "../src/helpers";

// Minimal search-card markup mirroring StepStone's real structure: a <style> block
// (Emotion CSS-in-JS noise) before the meaningful data-at attributes, and an <svg>
// icon before each field's text — parseJobCards must strip both and rely on the
// data-at attributes rather than the hashed class names.
function searchCard(id: string, title: string, company = "Acme GmbH", location = "Berlin"): string {
  return `<style data-emotion="res abc123">.res-abc123{color:red;}</style>
  <a class="res-xaz43y" href="/stellenangebote--${title.replace(/\s+/g, "-")}--${id}-inline.html" data-testid="job-item-title" data-at="job-item-title" tabindex="-1">
    <div class="res-ewgtgq">${title}</div>
  </a>
  <span data-at="job-item-company-name"><span class="res-215qah"><svg><path d="M0 0"/></svg><span class="res-du9bhi"><div class="res-ewgtgq">${company}</div></span></span></span>
  <span data-at="job-item-location"><span class="res-8wkck8"><svg><path d="M0 0"/></svg><span class="res-du9bhi">${location}</span></span></span>
  <span data-at="job-item-timeago"><time class="">vor 13 Stunden</time></span>`;
}

describe("parseJobCards", () => {
  test("extracts id, title, company, location, date, url from a card", () => {
    const html = searchCard("14293385", "Solution Architect (m/w/d)");
    const [card] = parseJobCards(html);
    expect(card).toBeDefined();
    expect(card!.id).toBe("14293385");
    expect(card!.title).toBe("Solution Architect (m/w/d)");
    expect(card!.company).toBe("Acme GmbH");
    expect(card!.location).toBe("Berlin");
    expect(card!.date).toBe("vor 13 Stunden");
    expect(card!.url).toBe(`https://www.stepstone.de/stellenangebote--Solution-Architect-(m/w/d)--14293385-inline.html`);
  });

  test("parses multiple cards and does not bleed fields across chunks", () => {
    const html = searchCard("1", "Engineer", "CompanyA", "Munich") + searchCard("2", "Manager", "CompanyB", "Hamburg");
    const cards = parseJobCards(html);
    expect(cards).toHaveLength(2);
    expect(cards[0]!.title).toBe("Engineer");
    expect(cards[0]!.company).toBe("CompanyA");
    expect(cards[1]!.title).toBe("Manager");
    expect(cards[1]!.company).toBe("CompanyB");
  });

  test("deduplicates a repeated href for the same id", () => {
    const single = searchCard("99", "Duplicate Role");
    const cards = parseJobCards(single + single);
    expect(cards).toHaveLength(1);
  });

  test("skips a chunk with no title and continues parsing the rest", () => {
    const broken = `<a href="/stellenangebote--broken--5-inline.html" data-at="job-item-title"></a>`;
    const html = broken + searchCard("6", "Valid Role");
    const cards = parseJobCards(html);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.id).toBe("6");
  });

  test("decodes HTML entities in the title", () => {
    const html = searchCard("7", "Caf&eacute; Manager".replace("&eacute;", "&#xE9;"));
    const [card] = parseJobCards(html);
    expect(card!.title).toBe("Café Manager");
  });
});

describe("parseTotalCount", () => {
  test("extracts the total job count from literal-quoted JSON", () => {
    const html = `"searchResultsTotalJobCount":145,"other":1`;
    expect(parseTotalCount(html)).toBe(145);
  });

  test("extracts the total job count from HTML-entity-encoded quotes (real page attribute form)", () => {
    const html = `data-atx-onpageview-payload="{&#34;searchResultsTotalJobCount&#34;:145,&#34;other&#34;:1}"`;
    expect(parseTotalCount(html)).toBe(145);
  });

  test("returns null when the payload is absent", () => {
    expect(parseTotalCount("<html></html>")).toBeNull();
  });
});

describe("slugify", () => {
  test("lowercases and hyphenates", () => {
    expect(slugify("Solution Architect")).toBe("solution-architect");
  });
  test("strips punctuation", () => {
    expect(slugify("Node.js / Backend!")).toBe("node-js-backend");
  });
});

describe("buildSearchUrl", () => {
  test("builds a bare query path with no location", () => {
    expect(buildSearchUrl("Solution Architect")).toBe("https://www.stepstone.de/jobs/solution-architect");
  });
  test("appends the in-<location> segment when a location is given", () => {
    expect(buildSearchUrl("Solution Architect", "Berlin")).toBe(
      "https://www.stepstone.de/jobs/solution-architect/in-berlin",
    );
  });
  test("never appends a query string (robots.txt disallows /jobs/*?* except ?q=)", () => {
    const url = buildSearchUrl("Engineering Manager", "Munich");
    expect(url).not.toContain("?");
  });
});

describe("idFromInput", () => {
  test("extracts id from a detail URL", () => {
    expect(idFromInput("https://www.stepstone.de/stellenangebote--x--14293385-inline.html")).toBe("14293385");
  });
  test("accepts a bare numeric id", () => {
    expect(idFromInput("14293385")).toBe("14293385");
  });
  test("returns null for unparsable input", () => {
    expect(idFromInput("not-an-id")).toBeNull();
  });
});

describe("parseJobDetail", () => {
  test("parses the schema.org JobPosting JSON-LD block", () => {
    const ld = {
      "@type": "JobPosting",
      title: "Solution Architect (m/w/d)",
      datePosted: "2026-07-17T08:48:47.777Z",
      validThrough: "2026-08-16T08:48:47.777Z",
      employmentType: "FULL_TIME",
      industry: "IT, IT-Architektur",
      description: "<p>Some role &amp; details.</p><p>Second paragraph.</p>",
      hiringOrganization: { name: "Acme GmbH", url: "https://www.stepstone.de/cmp/de/Acme-1/jobs.html" },
      jobLocation: { address: { addressLocality: "Berlin", addressRegion: "" } },
    };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    const job = parseJobDetail(html, "14293385", "https://www.stepstone.de/x--14293385-inline.html");
    expect(job.title).toBe("Solution Architect (m/w/d)");
    expect(job.company).toBe("Acme GmbH");
    expect(job.location).toBe("Berlin");
    expect(job.employmentType).toBe("FULL_TIME");
    expect(job.description).toContain("Some role & details.");
    expect(job.description).toContain("Second paragraph.");
  });

  test("falls back to an untitled stub when no JobPosting block is present", () => {
    const job = parseJobDetail("<html></html>", "1", "https://www.stepstone.de/x--1-inline.html");
    expect(job.title).toBe("(untitled)");
    expect(job.description).toBeNull();
  });
});

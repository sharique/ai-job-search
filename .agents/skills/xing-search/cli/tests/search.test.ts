import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke tests — these launch a real headless browser against the real site.
// Slower than the other portal skills' tests (a few seconds per call) and require
// network access + a system Chrome/Chromium install. Kept minimal on purpose.

interface SearchResult {
  meta: { count: number; page: number };
  results: Array<{ id: string; title: string; company: string | null; location: string | null; date: string | null; url: string }>;
}

describe("xing-cli live smoke test", () => {
  test("search returns at least one real result with non-null id/title/url", async () => {
    const result = await runCLI(["search", "-q", "Solution Architect", "-l", "Berlin", "--limit", "5"]);
    const parsed = parseJSON<SearchResult>(result);
    expect(parsed.results.length).toBeGreaterThan(0);
    const first = parsed.results[0]!;
    expect(first.id).toBeTruthy();
    expect(first.title).toBeTruthy();
    expect(first.url).toMatch(/^https:\/\/www\.xing\.com\/jobs\//);
  }, 30000);

  test("detail on a URL from search returns a real description", async () => {
    const search = await runCLI(["search", "-q", "Solution Architect", "-l", "Berlin", "--limit", "1"]);
    const parsed = parseJSON<SearchResult>(search);
    const first = parsed.results[0];
    expect(first).toBeDefined();

    const detailResult = await runCLI(["detail", first!.url]);
    const detail = parseJSON<{ title: string; description: string | null }>(detailResult);
    expect(detail.title).toBeTruthy();
    expect(detail.description).toBeTruthy();
  }, 30000);
});

import { afterEach, describe, expect, test } from "bun:test";
import { runSearch } from "../src/commands/search";

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write;

function searchCard(id: string, title: string): string {
  return `<a href="/stellenangebote--${title.replace(/\s+/g, "-")}--${id}-inline.html" data-at="job-item-title"><div>${title}</div></a>`;
}

function captureStdout(): { get: () => string } {
  let out = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    out += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  return { get: () => out };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdoutWrite;
});

describe("runSearch", () => {
  test("--limit 0 emits zero results", async () => {
    globalThis.fetch = (async () => new Response(searchCard("123456", "Engineer"))) as typeof fetch;
    const out = captureStdout();

    const code = await runSearch({ query: "Engineer", page: 1, limit: 0, format: "json" });

    expect(code).toBe(0);
    expect(JSON.parse(out.get()).results).toHaveLength(0);
  });

  test("page > 1 returns an explicit warning instead of silently re-serving page 1", async () => {
    globalThis.fetch = (async () => new Response(searchCard("1", "Engineer"))) as typeof fetch;
    const out = captureStdout();

    const code = await runSearch({ query: "Engineer", page: 2, format: "json" });

    expect(code).toBe(0);
    const parsed = JSON.parse(out.get());
    expect(parsed.results).toHaveLength(0);
    expect(parsed.meta.warning).toMatch(/page 2\+/i);
  });

  test("page 1 returns parsed results with no warning", async () => {
    globalThis.fetch = (async () => new Response(searchCard("1", "Engineer"))) as typeof fetch;
    const out = captureStdout();

    const code = await runSearch({ query: "Engineer", page: 1, format: "json" });

    expect(code).toBe(0);
    const parsed = JSON.parse(out.get());
    expect(parsed.results).toHaveLength(1);
    expect(parsed.meta.warning).toBeUndefined();
  });
});

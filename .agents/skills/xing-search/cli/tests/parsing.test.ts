import { describe, test, expect } from "bun:test";
import { idFromUrl, buildSearchUrl, jobPostingToDetail } from "../src/helpers";

describe("idFromUrl", () => {
  test("extracts trailing numeric id from a slugged path", () => {
    expect(idFromUrl("/jobs/berlin-cloud-software-architect-ai-platform-156225861")).toBe("156225861");
  });
  test("extracts id from a bare /jobs/<id> path", () => {
    expect(idFromUrl("/jobs/156225861")).toBe("156225861");
  });
  test("extracts id from a full URL", () => {
    expect(idFromUrl("https://www.xing.com/jobs/berlin-solution-architect-999")).toBe("999");
  });
  test("returns null when no numeric id is present", () => {
    expect(idFromUrl("/jobs/search?keywords=foo")).toBeNull();
  });
});

describe("buildSearchUrl", () => {
  test("builds a URL with keywords only", () => {
    const url = buildSearchUrl("Solution Architect");
    expect(url).toBe("https://www.xing.com/jobs/search?keywords=Solution+Architect");
  });
  test("includes location when given", () => {
    const url = buildSearchUrl("Solution Architect", "Berlin");
    expect(url).toContain("location=Berlin");
  });
  test("omits page param for page 1", () => {
    const url = buildSearchUrl("Solution Architect", undefined, 1);
    expect(url).not.toContain("page=");
  });
  test("includes page param for page > 1", () => {
    const url = buildSearchUrl("Solution Architect", undefined, 2);
    expect(url).toContain("page=2");
  });
});

describe("jobPostingToDetail", () => {
  const baseJobPosting = {
    "@type": "JobPosting",
    title: "Solution Architect (m/w/d)",
    datePosted: "2026-07-10T11:16:16Z",
    validThrough: "2026-09-08T11:19:18Z",
    employmentType: "Full-time",
    industry: "Other industries",
    description: "<p>Role &amp; details.</p><p>Second paragraph.</p>",
    hiringOrganization: { name: "Acme GmbH", url: "https://www.xing.com/pages/acme" },
    jobLocation: [{ address: { addressLocality: "Berlin", addressRegion: "Berlin" } }],
  };

  test("maps core fields", () => {
    const job = jobPostingToDetail(baseJobPosting, "156225861", "https://www.xing.com/jobs/x-156225861");
    expect(job.title).toBe("Solution Architect (m/w/d)");
    expect(job.company).toBe("Acme GmbH");
    expect(job.location).toBe("Berlin");
    expect(job.employmentType).toBe("Full-time");
    expect(job.description).toContain("Role & details.");
    expect(job.description).toContain("Second paragraph.");
  });

  test("dedupes identical locality/region into a single location value", () => {
    const job = jobPostingToDetail(
      { ...baseJobPosting, jobLocation: [{ address: { addressLocality: "Berlin", addressRegion: "Berlin" } }] },
      "1",
      "https://www.xing.com/jobs/x-1",
    );
    expect(job.location).toBe("Berlin");
  });

  test("strips a leading standalone 'null' rendering artifact from description", () => {
    const job = jobPostingToDetail(
      { ...baseJobPosting, description: "\n    null\n    Einleitung\n    <p>Real content.</p>" },
      "1",
      "https://www.xing.com/jobs/x-1",
    );
    expect(job.description).not.toMatch(/^null/);
    expect(job.description).toContain("Real content.");
  });

  test("formats baseSalary into a readable range", () => {
    const job = jobPostingToDetail(
      {
        ...baseJobPosting,
        baseSalary: { "@type": "MonetaryAmount", currency: "EUR", value: { minValue: 70000, maxValue: 100000 } },
      },
      "1",
      "https://www.xing.com/jobs/x-1",
    );
    expect(job.salary).toBe("70,000-100,000 EUR");
  });

  test("handles missing optional fields gracefully", () => {
    const job = jobPostingToDetail({ "@type": "JobPosting", title: "Minimal" }, "1", "https://www.xing.com/jobs/x-1");
    expect(job.title).toBe("Minimal");
    expect(job.company).toBeNull();
    expect(job.location).toBeNull();
    expect(job.salary).toBeNull();
  });
});

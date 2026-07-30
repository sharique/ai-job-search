import { BASE_URL, fetchXingDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/**
 * Unlike StepStone, Xing's detail URL requires the *exact* slug — a bare numeric ID
 * (e.g. "156225861") does not 404 or resolve to the job; it silently falls through to
 * a keyword-search results page instead (confirmed: title becomes "Current
 * 156225861 jobs"). A bare ID is therefore rejected outright rather than guessed at,
 * to avoid returning a search page dressed up as a job detail.
 */
function normalizeUrl(input: string): string | null {
  if (/^\d+$/.test(input.trim())) return null
  if (input.startsWith("http")) return input
  if (input.startsWith("/jobs/")) return `${BASE_URL}${input}`
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const url = normalizeUrl(opts.id)
  if (!url) {
    writeError(
      `"${opts.id}" is not a usable Xing job URL. Xing requires the full URL/path from ` +
        `search results (e.g. "/jobs/berlin-solution-architect-123456" or the full ` +
        `https://www.xing.com/... URL) — a bare numeric ID is not enough here.`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const { status, detail } = await fetchXingDetail(url)
    if (status === 410 || status === 404 || !detail) {
      writeError("Job not found (posting may have expired or the URL is incorrect)", "NOT_FOUND")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        detail.title,
        `${detail.company || "—"} · ${detail.location || "—"}`,
        "",
        detail.employmentType ? `Employment: ${detail.employmentType}` : "",
        detail.industry ? `Industry: ${detail.industry}` : "",
        detail.salary ? `Salary: ${detail.salary}` : "",
        detail.datePosted ? `Posted: ${detail.datePosted}` : "",
        detail.validThrough ? `Valid through: ${detail.validThrough}` : "",
        "",
        detail.description || "(no description)",
        "",
        `URL: ${detail.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}

# Template: sharique

- **Type:** CV
- **Engine:** pdflatex
- **Page limit:** 2 page(s)
- **Fonts:** TeX Gyre Heros (system font, part of standard TeX Live - substitutes for the original design's Arial/system-ui, since Arial itself isn't legally redistributable via TeX)
- **Class/packages:** `article` base class; standard packages only - `geometry`, `xcolor` (table option), `graphicx`, `tikz`, `hyperref`, `titlesec`, `microtype`, `tabularx`. No `enumitem` or `tcolorbox` (not present on this machine's TeX Live install) - see "Known pitfalls" for the workarounds used instead.

## Origin

Recreated in LaTeX from an HTML/CSS resume export (`all.html` / `style.css`, originally produced by a resume-builder tool - not moderncv). There was no LaTeX source to register directly, so the design was rebuilt from the CSS's exact colors, font sizes, and layout rules.

## Compile command

    cd <output dir> && pdflatex -interaction=nonstopmode <file>.tex

## Style rules

- **Colors** (from source CSS, exact hex): accent blue `#185FA5` (name/section titles/company names/links), gray `#6B7280` (dates, locations, skill items), dark text `#1A1A1A` (body), award-box background `#E6F1FB`.
- **Header:** name (22pt bold) + headline (11pt, blue) + one-line contact row (8.5pt, gray, items separated by `\quad`) on the left; a small rounded-corner photo on the right; a 1.2pt blue rule spans the full width below the header.
- **Section titles:** bold, blue, small (8pt), typed in UPPERCASE directly in the `\section{...}` argument (not auto-transformed - see pitfalls), wrapped in `\textls[150]{...}` for letter-spacing, with a thin light-gray rule underneath.
- **Skills / Certifications:** two-column grid via `tabularx` (`X X` columns) - category/name bold, items/date in gray beneath. A "full-width" skills row (e.g. "Technologies & Foundational") spans both columns below the grid.
- **Professional Experience / Projects:** `\entryrow{title}{dates}` puts the entry title bold-left and the date range gray-right on one line (space-between layout). `\entrysub{company + location}` follows in blue, with the location portion switched to gray mid-string via an embedded `\color{graytext}` - compose this string in the template body, e.g. `\entrysub{Company \color{graytext}\textbullet\ Location}`. Entries with no company/location line (e.g. an "Earlier Experience" roll-up) skip `\entrysub` entirely.
- **Award/highlight callout:** `\awardbox{title}{text}` - use sparingly, at most once per role, only for a genuinely distinct highlight (matches the source's single "OKR of the Quarter" usage).
- **Bullets:** use the `compactitem` environment (not plain `itemize` - see pitfalls), tight 2pt item spacing, small bullet glyph.
- **Languages:** single line, name (bold) + level (gray, in parens), separated by `\qquad`.

## Known pitfalls

- **No `enumitem` on this machine's TeX Live install.** The template defines a `compactitem` environment (plain `itemize` with manually overridden `\itemsep`/`\topsep`/`\parsep`/`\leftmargin`) instead of `enumitem`'s `\setlist`. Use `compactitem`, not `itemize`, throughout - if `itemize` is used directly it will still compile but with default (looser) spacing that no longer matches the design.
- **No `tcolorbox` on this machine's TeX Live install.** The award callout (`\awardbox`) is built with a two-column `tabular` using `colortbl`'s `\columncolor` (a 2pt blue column + a light-blue content column) instead. This is a standard, dependency-light idiom - if `tcolorbox` is confirmed available in a future environment it could replace this for cleaner code, but there is no need to change it.
- **Section titles are typed in UPPERCASE by hand** (e.g. `\section{\textls[150]{PROFESSIONAL SUMMARY}}`), not auto-uppercased by `titleformat`. Nesting `\MakeUppercase` inside a `titlesec` format string to wrap the section argument is a known fragile hack (unclosed-brace trick) - typing headers in caps directly is more robust and was chosen deliberately. If a drafter adds a new section, remember to type its title in caps.
- **`\textls` (microtype letter-spacing) triggers a harmless `hyperref` warning** ("Token not allowed in a PDF string (Unicode): removing `\textls`") for the PDF bookmarks/outline. This does not affect the visible page content - only the (unused) PDF outline entries. Safe to ignore.
- **Photo placeholder must exist and be roughly square** (`[YOUR_PHOTO]`, clipped to 2.1cm x 2.1cm with a 1.5pt corner radius via a `tikz` clip). If no photo is supplied for a given application, either remove the photo `minipage` and widen the text `minipage` to `\linewidth`, or substitute a blank/neutral placeholder image - do not leave `[YOUR_PHOTO]` unresolved, `\includegraphics` will hard-fail the compile.
- **Original HTML/CSS design also had a `@media print` mode** (smaller fonts, tighter margins, A4 0.6cm/0.8cm page margins) that produces a denser ~3-page result for the full master CV. This template instead uses the more readable on-screen CSS sizing as its baseline (10-22pt range) so that a 2-page tailored CV (per this framework's hard page limit) stays comfortably readable - don't reach for the print-mode sizes to force-fit content; cut content per `05-cv-templates.md`'s relevance-weighted cutting rules instead.

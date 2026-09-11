# LinkedIn Job Summary Extension — Design

Date: 2026-09-11
Status: Approved

## Problem

Reading a LinkedIn job posting to answer two questions — what skills does it want, and how
many years does it demand — currently requires scrolling through the whole description.
That cost is paid on every job in a search session, and most jobs get rejected on those two
facts alone.

## Goal

While browsing LinkedIn jobs, show a compact summary card above each job description, with
no clicks, listing required skills, preferred skills, years of experience, and education.

## Non-goals

- Comparing the job against the user's own skills or experience. Deferred.
- Any network call, API key, or account. The extension is fully local.
- Badges on the job results list. Only the open job is summarized.
- Storing, exporting, or tracking jobs the user has viewed.
- Auto-applying, auto-filling, or any write action on LinkedIn.

## Platform

Manifest V3 extension, loaded unpacked via `edge://extensions` with developer mode on.
Edge is Chromium, so the extension is a standard Chrome MV3 extension with no Edge-specific
code and works unmodified in Chrome.

Permissions: none. The extension declares only a `content_scripts` match for LinkedIn job
URLs. It therefore cannot read any other site, has no host permission prompt, and makes no
requests of its own.

## Architecture

```
linkedin-job-summary/
  manifest.json
  src/content.js      # page observer + injection glue (DOM-bound)
  src/extractor.js    # pure: description text -> summary object (no DOM)
  src/skills.js       # canonical skill dictionary with aliases
  src/card.js         # summary object -> DOM element
  src/card.css        # scoped styles
  test/
    extractor.test.js
    fixtures/*.txt    # real job descriptions saved as text
  icons/
```

The DOM-bound layer (`content.js`, `card.js`) is deliberately thin. All logic that can be
wrong lives in `extractor.js`, which is a pure function of a string and is unit tested.

### Data flow

1. `content.js` runs on a matching LinkedIn URL.
2. A `MutationObserver` on the job details pane fires when the pane content changes.
3. The handler resolves the current job id and, if it differs from the last one rendered,
   locates the description element and reads its `innerText`.
4. The text goes to `extractor.extract(text)`, returning a summary object.
5. `card.render(summary)` builds an element, which is inserted directly above the
   description element.
6. If the card is removed by a LinkedIn re-render, the observer re-injects it.

### Page matching

Content script matches:

- `https://www.linkedin.com/jobs/*` (covers search, collections, and view pages)

Both the split list-plus-detail layout and the standalone job page route through the same
description lookup, so no per-layout branching is needed.

### Locating the description

Selectors are tried in order, first match wins:

1. LinkedIn's job description container (`.jobs-description__content`, and the
   `#job-details` region).
2. Known alternates for the standalone job view (`.show-more-less-html__markup`).
3. Heuristic fallback: within the details pane, the descendant with the most text content
   over a minimum length threshold.

LinkedIn clamps long descriptions visually behind a "See more" control, but the full text is
present in the DOM. No click or expansion is required.

If all three layers fail, the card renders a single line stating the posting could not be
read. Silent absence is not acceptable, because the user must be able to tell "no
requirements found" apart from "extension broken".

## Extraction

### Sectioning

The description text is split into blocks on headings and blank lines. Each block is
classified by its heading and lead-in text:

- **required** — requirements, qualifications, must have, minimum qualifications, you have,
  what you bring, basic qualifications
- **preferred** — preferred, nice to have, bonus, plus, desired, good to have,
  preferred qualifications
- **other** — about us, benefits, equal opportunity, compensation

Unclassified blocks default to **required**, because most postings state hard requirements in
unlabeled prose. Blocks classified **other** are excluded from skill extraction, so benefits
boilerplate does not pollute the results.

### Skills

`skills.js` holds roughly 400 canonical skills, each with an alias list, covering languages,
frameworks, cloud platforms, data tooling, and common developer tools.

- Matching is word-boundary regex, case-insensitive, against block text.
- Short and ambiguous names (Go, R, C, Rust) use tightened patterns to avoid matching Google,
  ordinary capital letters, or English words.
- A skill found in a preferred block goes to preferred; anything else goes to required.
- A skill appearing in both groups is reported as required only.
- Each group is ordered by first appearance and capped at 12 entries, keeping the card
  scannable.

### Years of experience

Regex covers the common phrasings:

- `5+ years`, `5 + years`, `5 yrs`
- `3-5 years`, `3 to 5 years`
- `at least two years`, `minimum of 7 years`, `no less than 4 years`
- spelled-out numbers one through fifteen

Each hit is scored by proximity to a general experience phrase (`years of experience`,
`professional experience`, `industry experience`) versus a specific technology name. The
highest-scoring general hit becomes the headline number. Technology-specific hits are
retained and rendered inline beside that skill, so "3 years of Python" reads as a qualifier
on Python rather than as the job's overall bar.

Ranges report as the range. If no hit qualifies as general, no experience row is shown. The
extension never guesses a number.

### Education

Patterns for bachelor, master, doctorate and their abbreviations (BS, B.S., BA, MS, M.S.,
MBA, PhD), plus the field of study when one follows. Equivalency phrases such as
"or equivalent experience" and "or equivalent practical experience" are captured and shown,
because they change whether the requirement is binding.

## The card

Injected as a sibling immediately above the description element, so it sits in normal page
flow and pushes the description down rather than overlaying it.

Rows, in order:

1. Experience
2. Required skills
3. Preferred skills
4. Education

Rows with no extracted value are omitted entirely rather than rendered empty. All styles are
scoped under a single prefixed root class (`ljs-`) to avoid colliding with or leaking into
LinkedIn's stylesheet. The card is visually quiet: one bordered block, LinkedIn-native font
stack, skills as inline tags.

## Testing

`extractor.js` takes a string and returns an object, with no DOM dependency, so it is tested
under Node with no browser.

Fixtures are real job descriptions saved as text files under `test/fixtures/`, covering:

1. A well-structured posting with explicit Requirements and Preferred headings.
2. A vague prose posting with no headings.
3. A preferred-heavy posting where most skills are optional.
4. A posting stating no years at all, asserting that no experience row is produced.
5. A posting with technology-specific years, asserting the headline number is the general one.

Each fixture asserts the expected required skills, preferred skills, years, and education.

The DOM glue is verified manually by loading the unpacked extension and opening real
LinkedIn job pages in both the search layout and the standalone job view.

## Known limits

- Skills outside the dictionary are missed. The card is a fast filter, not a replacement for
  reading a posting that looks promising.
- Postings that never state a number show no experience row.
- LinkedIn markup changes can break the description lookup. The layered selectors and the
  visible failure message make that state obvious rather than silent.

## Deferred

- Personal skill profile with match and gap highlighting.
- Badges on job list items.
- An options page for tuning the dictionary.

# LinkedIn Job Summary

A browser extension that puts a summary card directly under the job header on LinkedIn, so
you can see the required skills and the years of experience without scrolling the posting.

## Install in Edge

1. Open `edge://extensions`.
2. Turn on Developer mode.
3. Click "Load unpacked" and select this folder.

The same folder loads in Chrome through `chrome://extensions` with the same steps.

## Company size

LinkedIn publishes no exact headcount for a company. The job page gives a bracket, such as
"1,001-5,000 employees", and one precise figure, "1,662 on LinkedIn", which counts employees
holding a LinkedIn profile rather than employees.

The card shows the precise figure because it is precise, labelled `1,662 on LinkedIn` so it
is not mistaken for a headcount. It undercounts by however many staff have no LinkedIn
account. Hovering shows the bracket. On a page giving only the bracket, the chip shows that
instead, abbreviated to `1k-5k employees` so it stays scannable.

## What it reads and sends

It reads the text of the job description on LinkedIn job pages. It sends nothing anywhere. There is no API key, no account, no server, and no analytics.
The manifest declares no permissions at all beyond a single content script match, so the
extension cannot see any other site.

The match covers `linkedin.com` rather than `linkedin.com/jobs/` alone, and the script exits
immediately on any path outside `/jobs/`. The wider match is necessary, not convenient: a
content script loads only with the document, and LinkedIn routes between sections in the
page, so arriving at Jobs from the feed never loaded the script at all. Narrowing the match
again would mean adding the `scripting` permission and a background worker, which is strictly
more access, not less.

## How it decides

Skills come from a dictionary of over 300 technologies and practices, matched against the
posting text. A skill found under a Preferred or Nice to Have heading, or on a line saying
"a plus", is listed as preferred; everything else is listed as required.

Years of experience come from phrases like "5+ years" and "at least three years". A number
sitting next to a specific technology qualifies that technology instead of becoming the
headline, so "3 years of Python" shows as a tag on Python and does not become the job's bar.

Education is extracted but no longer displayed, because the row cost more vertical space
than it was worth. The `education` field is still on the summary object and still tested, so
putting the row back is a few lines in `src/card.js`.

The card inherits the page's text colour and uses translucent backgrounds, so it reads
correctly in LinkedIn's light and dark themes without detecting which is active.

## Known limits

- Skills outside the dictionary are missed. Treat the card as a fast filter, not a
  replacement for reading a posting you actually like.
- A posting that never states a number shows no Experience row. The extension does not guess.
- LinkedIn can change its markup. If that happens the card says so rather than silently
  disappearing.
- The card appears on `/jobs/` pages only. Job links from a company page land there, so this
  covers normal browsing, but a job rendered anywhere else gets no card.

## Tests

    npm test

Runs the extractor unit tests and the fixture postings under Node. No dependencies.

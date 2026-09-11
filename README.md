# LinkedIn Job Summary

A browser extension that puts a summary card above every LinkedIn job description, so you
can see the required skills, the years of experience, and the education bar without
scrolling the posting.

## Install in Edge

1. Open `edge://extensions`.
2. Turn on Developer mode.
3. Click "Load unpacked" and select this folder.

The same folder loads in Chrome through `chrome://extensions` with the same steps.

## What it reads and sends

It reads the text of the job description on pages under `https://www.linkedin.com/jobs/`.
It sends nothing anywhere. There is no API key, no account, no server, and no analytics.
The manifest declares no permissions beyond that one content script match, so the extension
cannot see any other site.

## How it decides

Skills come from a dictionary of over 300 technologies and practices, matched against the
posting text. A skill found under a Preferred or Nice to Have heading, or on a line saying
"a plus", is listed as preferred; everything else is listed as required.

Years of experience come from phrases like "5+ years" and "at least three years". A number
sitting next to a specific technology qualifies that technology instead of becoming the
headline, so "3 years of Python" shows as a tag on Python and does not become the job's bar.

Education comes from degree phrases, and the lowest level stated is reported, because that
is the actual bar.

## Known limits

- Skills outside the dictionary are missed. Treat the card as a fast filter, not a
  replacement for reading a posting you actually like.
- A posting that never states a number shows no Experience row. The extension does not guess.
- LinkedIn can change its markup. If that happens the card says so rather than silently
  disappearing.

## Tests

    npm test

Runs the extractor unit tests and the fixture postings under Node. No dependencies.

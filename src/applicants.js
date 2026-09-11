(function (root) {
  'use strict';

  // LinkedIn renders this block only for Premium members, so on a free account
  // the heading is simply absent and parse returns null. That is the whole
  // gating mechanism: nothing is hidden or unlocked, the data is either on the
  // page or it is not.
  const HEADING_RE = /candidates?\s+who\s+clicked\s+apply/i;
  const TOTAL_RE = /([\d,]+)\s*total\b/i;
  const RECENT_RE = /([\d,]+)\s*in the past\s+(day|week|month|24 hours)\b/i;

  // Only look just past the heading. The surrounding page is full of other
  // numbers, and a wider window would happily read one of those instead.
  const WINDOW = 240;

  function toNumber(raw) {
    const n = parseInt(String(raw).replace(/,/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  }

  function parse(text) {
    const source = String(text == null ? '' : text);
    const heading = source.match(HEADING_RE);
    if (!heading) return null;

    const window = source.slice(heading.index, heading.index + WINDOW);
    const total = TOTAL_RE.exec(window);
    if (!total) return null;

    const totalCount = toNumber(total[1]);
    if (totalCount == null) return null;

    const recent = RECENT_RE.exec(window);
    return {
      total: totalCount,
      recent: recent ? toNumber(recent[1]) : null,
      period: recent ? recent[2].toLowerCase() : null
    };
  }

  root.LJSApplicants = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSApplicants;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

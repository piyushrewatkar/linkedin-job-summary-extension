(function (root) {
  'use strict';

  // LinkedIn writes the company line as "Software Development · 1,001-5,000
  // employees · 1,662 on LinkedIn". The size is a bracket, not a headcount, and
  // the second figure counts profiles rather than staff, so they are kept apart.
  const RANGE_RE = /([\d,]+)\s*(?:-|–|—|to)\s*([\d,]+)\s*employees/i;
  const OPEN_RE = /([\d,]+)\s*\+\s*employees/i;
  const EXACT_RE = /(?:^|[^\d,])([\d,]+)\s+employees/i;
  const ON_LINKEDIN_RE = /([\d,]+)\s+(?:on LinkedIn|associated members)/i;

  function toNumber(raw) {
    const n = parseInt(String(raw).replace(/,/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  }

  // "1,001-5,000 employees" reads better as "1k-5k" on a card meant to be
  // scanned. Below a thousand the exact figure is short enough to keep.
  function shorten(n) {
    if (n == null) return null;
    return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n);
  }

  function parse(text) {
    const source = String(text == null ? '' : text);

    let min = null;
    let max = null;
    let label = null;

    const range = RANGE_RE.exec(source);
    const open = OPEN_RE.exec(source);
    const exact = EXACT_RE.exec(source);

    if (range) {
      min = toNumber(range[1]);
      max = toNumber(range[2]);
      if (min != null && max != null) label = shorten(min) + '-' + shorten(max) + ' employees';
    } else if (open) {
      min = toNumber(open[1]);
      if (min != null) label = shorten(min) + '+ employees';
    } else if (exact) {
      min = toNumber(exact[1]);
      max = min;
      if (min != null) label = shorten(min) + ' employees';
    }

    if (!label) return null;

    const onLinkedIn = ON_LINKEDIN_RE.exec(source);
    return {
      label: label,
      min: min,
      max: max,
      onLinkedIn: onLinkedIn ? toNumber(onLinkedIn[1]) : null
    };
  }

  root.LJSCompany = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSCompany;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

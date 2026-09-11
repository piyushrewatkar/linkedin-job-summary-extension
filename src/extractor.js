(function (root) {
  'use strict';

  // Ordered: preferred is checked before required, because "Preferred
  // Qualifications" contains "qualifications" and must not be read as required.
  const HEADING_RULES = [
    {
      type: 'preferred',
      re: /\b(preferred|nice[-\s]to[-\s]have|bonus|desired|desirable|good to have|pluses|extra credit)\b/i
    },
    {
      type: 'other',
      re: /\b(about (us|the company|the team)|who we are|benefits|perks|compensation|pay range|salary|equal opportunit|eeo|diversity|our mission|why join|how to apply|accommodation|disclaimer|next steps)\b/i
    },
    {
      type: 'required',
      re: /\b(requirements?|qualifications?|must[-\s]have|what you(?:.{0,10})(?:bring|need)|you have|your background|skills|experience|responsibilit|who you are|what you.{0,5}ll do)\b/i
    }
  ];

  function classifyHeading(line) {
    for (const rule of HEADING_RULES) {
      if (rule.re.test(line)) return rule.type;
    }
    return null;
  }

  function isHeadingLine(line) {
    const t = line.trim();
    if (t.length < 2 || t.length > 90) return false;
    if (/^[-•*•●\d]/.test(t)) return false; // bullets and numbered items
    if (t.split(/\s+/).length > 10) return false;
    if (t.endsWith(':')) return true;
    if (t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
    return classifyHeading(t) !== null && !/[.!?]$/.test(t);
  }

  function splitSections(text) {
    const lines = String(text == null ? '' : text).split(/\r?\n/);
    const blocks = [];
    let current = { type: 'required', lines: [] };

    for (const line of lines) {
      if (isHeadingLine(line)) {
        const type = classifyHeading(line);
        if (type) {
          if (current.lines.join('').trim()) blocks.push(current);
          current = { type: type, lines: [] };
          continue; // the heading itself is not body text
        }
      }
      current.lines.push(line);
    }
    if (current.lines.join('').trim()) blocks.push(current);

    return blocks
      .map((b) => ({ type: b.type, text: b.lines.join('\n').trim() }))
      .filter((b) => b.text.length > 0);
  }

  root.LJSExtractor = { splitSections: splitSections };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSExtractor;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

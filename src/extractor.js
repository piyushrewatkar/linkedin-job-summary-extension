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

  const PREFERRED_LINE_RE =
    /\b(preferred|nice[-\s]to[-\s]have|a plus|bonus|desirable|ideally|would be (?:great|nice)|familiarity with)\b/i;

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  let matcherCache = null;

  function getMatchers() {
    if (matcherCache) return matcherCache;
    const skills = root.LJS_SKILLS || [];
    matcherCache = skills.map((skill) => {
      if (skill.pattern) return { name: skill.name, re: skill.pattern };
      const terms = [skill.name].concat(skill.aliases || []);
      const alt = terms
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join('|');
      return {
        name: skill.name,
        re: new RegExp('(?<![A-Za-z0-9])(?:' + alt + ')(?![A-Za-z0-9])', 'i')
      };
    });
    return matcherCache;
  }

  // Boilerplate is dropped only when real content survives. A posting whose whole
  // body sits under a single "About us" heading would otherwise yield nothing.
  function usableSections(sections) {
    const useful = sections.filter((s) => s.type !== 'other');
    const hasSubstance = useful.some((s) => s.text.length >= 80);
    if (hasSubstance) return useful;
    return sections.map((s) => ({
      type: s.type === 'other' ? 'required' : s.type,
      text: s.text
    }));
  }

  const MAX_PER_GROUP = 12;

  function extractSkills(sections) {
    const matchers = getMatchers();
    const found = new Map();
    let lineIndex = 0;

    for (const section of sections) {
      for (const line of section.text.split(/\r?\n/)) {
        const lineGroup =
          PREFERRED_LINE_RE.test(line) || section.type === 'preferred'
            ? 'preferred'
            : 'required';
        for (const matcher of matchers) {
          // exec rather than test: the match position is what orders skills that
          // share a line. Counting once per line ties them, and a tie falls back
          // to dictionary order, so "Kafka and gRPC" would report gRPC first.
          const hit = matcher.re.exec(line);
          if (!hit) continue;
          const prev = found.get(matcher.name);
          if (!prev) {
            found.set(matcher.name, {
              name: matcher.name,
              group: lineGroup,
              order: lineIndex * 10000 + hit.index
            });
          } else if (prev.group === 'preferred' && lineGroup === 'required') {
            prev.group = 'required';
          }
        }
        lineIndex += 1;
      }
    }

    const all = Array.from(found.values()).sort((a, b) => a.order - b.order);
    return {
      required: all.filter((s) => s.group === 'required').slice(0, MAX_PER_GROUP).map((s) => s.name),
      preferred: all.filter((s) => s.group === 'preferred').slice(0, MAX_PER_GROUP).map((s) => s.name)
    };
  }

  root.LJSExtractor = {
    splitSections: splitSections,
    usableSections: usableSections,
    extractSkills: extractSkills
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSExtractor;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

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
    if (/^[-•*●\d]/.test(t)) return false; // bullets and numbered items
    if (t.split(/\s+/).length > 10) return false;
    if (t.endsWith(':')) return true;
    if (t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
    // A keyword-only heading is short. Without this cap, "Experience with Java
    // and Spring Boot" reads as a heading and the line is dropped. Browsers do
    // not put a bullet character in innerText, so the guard above cannot protect
    // a list item, and a swallowed bullet loses its skills silently.
    return (
      t.split(/\s+/).length <= 4 &&
      classifyHeading(t) !== null &&
      !/[.!?]$/.test(t)
    );
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
    if (!root.LJS_SKILLS) return []; // not loaded yet; never cache the empty case
    const skills = root.LJS_SKILLS;
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

  // Twelve was too few. A real posting can state twenty technologies, and
  // cutting .NET and C# from a .NET job defeats the point of the card.
  const MAX_PER_GROUP = 24;

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

  const NUM_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15
  };
  const NUM = '\\d{1,2}|' + Object.keys(NUM_WORDS).join('|');

  const YEARS_RE = new RegExp(
    '((?<![A-Za-z])at least|(?<![A-Za-z])minimum(?:\\s+of)?|(?<![A-Za-z])min\\.?|' +
      '(?<![A-Za-z])no less than|(?<![A-Za-z])over|(?<![A-Za-z])more than)?\\s*' +
      '(?<![\\d.])(' + NUM + ')' +
      '\\s*(?:(\\+|plus)|(?:\\s*(?:-|–|—|to)\\s*(' + NUM + ')))?' +
      '\\s*\\+?\\s*(?:years?|yrs?)\\b',
    'gi'
  );

  const EXPERIENCE_NEARBY_RE = /\b(experience|background|track record)\b/i;
  const GENERAL_EXPERIENCE_RE =
    /\b(professional|industry|relevant|overall|software|engineering|work|hands[-\s]on|combined)\s+experience\b|\byears?\s+of\s+experience\b/i;

  function toNumber(token) {
    if (token == null) return null;
    const t = String(token).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NUM_WORDS, t)) return NUM_WORDS[t];
    const n = parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
  }

  function yearsLabel(min, max, plus) {
    if (max != null) return min + '-' + max + ' years';
    if (plus) return min + '+ years';
    return min + (min === 1 ? ' year' : ' years');
  }

  function extractYears(sections) {
    const matchers = getMatchers();
    const candidates = [];
    const perSkill = {};
    let lineIndex = 0;

    // The context window is one line, never the whole section. A wider window
    // lets a skill on the next bullet capture the headline number, so
    // "7+ years of experience" followed by "3+ years of Python" would be read
    // as Python-specific and the job would show no overall bar.
    for (const section of sections) {
      for (const line of section.text.split(/\r?\n/)) {
        YEARS_RE.lastIndex = 0;
        let m;
        while ((m = YEARS_RE.exec(line)) !== null) {
          const min = toNumber(m[2]);
          if (min == null || min < 1 || min > 40) continue;
          const max = toNumber(m[4]);
          const plus = Boolean(m[3]) || Boolean(m[1]);

          let namedSkill = null;
          if (!GENERAL_EXPERIENCE_RE.test(line)) {
            // "8+ years of professional experience building services on AWS" is
            // the job's overall bar, not AWS's, so a general phrase wins outright.
            // Otherwise the qualifying skill is the one named just after the
            // phrase, chosen by position rather than by dictionary order.
            const end = m.index + m[0].length;
            const near = line.slice(end, end + 40);
            let nearest = Infinity;
            for (const matcher of matchers) {
              const hit = matcher.re.exec(near);
              if (hit && hit.index < nearest) {
                nearest = hit.index;
                namedSkill = matcher.name;
              }
            }
          }

          if (namedSkill) {
            if (perSkill[namedSkill] == null) perSkill[namedSkill] = min;
            continue; // technology-specific, never the headline
          }
          if (!EXPERIENCE_NEARBY_RE.test(line)) continue; // "20 days", "401k" and friends

          candidates.push({
            min: min,
            max: max,
            label: yearsLabel(min, max, plus),
            score:
              (section.type === 'required' ? 2 : 0) +
              (GENERAL_EXPERIENCE_RE.test(line) ? 2 : 0),
            order: lineIndex * 1000 + m.index
          });
        }
        lineIndex += 1;
      }
    }

    candidates.sort((a, b) => (b.score - a.score) || (a.order - b.order));
    const best = candidates[0] || null;

    return {
      headline: best ? { label: best.label, min: best.min, max: best.max } : null,
      perSkill: perSkill
    };
  }

  const EDU_FIELD = '(?:\\s+(?:in|of)\\s+([A-Za-z][A-Za-z ,/&-]{1,60}?))?';
  const EDU_TAIL = '(?=[.,;:)\\n]|\\s+(?:or|and|with|is|are|required|preferred|from|plus)\\b|$)';

  // Spelled-out levels are safe to match case-insensitively.
  const EDU_WORD_RE = new RegExp(
    "\\b(associate(?:'s|s)?|bachelor(?:'s|s)?|master(?:'s|s)?|mba|ph\\.?\\s?d\\.?|doctorate|doctoral)\\b" +
      '(?:\\s+degree)?' + EDU_FIELD + EDU_TAIL,
    'gi'
  );

  // Abbreviations must be matched case-sensitively. Case-insensitively, "B.E."
  // also matches the ordinary word "be", so "travel may be required" would be
  // reported as a bachelor degree.
  const EDU_ABBR_RE = new RegExp(
    '\\b(B\\.?S\\.?c?|B\\.?E\\.?|B\\.?Tech|M\\.?S\\.?c?|M\\.?Eng|M\\.?Tech)\\b' +
      '(?:\\s+degree)?' + EDU_FIELD + EDU_TAIL,
    'g'
  );

  // BA and MA also spell a US state and a job title, so they count only when a
  // degree word or a field of study follows. "Cambridge, MA." is not a master's.
  const EDU_AMBIGUOUS_ABBR_RE = new RegExp(
    '\\b(B\\.?A\\.?|M\\.?A\\.?)\\b(?=\\s+(?:degree|in|of)\\b)' +
      '(?:\\s+degree)?' + EDU_FIELD + EDU_TAIL,
    'g'
  );

  const EQUIVALENT_RE =
    /or\s+equivalent(?:\s+(?:practical\s+|relevant\s+|work\s+)?(?:experience|training|qualification)s?)?/i;

  const LEVEL_RANK = { "Associate's": 1, "Bachelor's": 2, "Master's": 3, PhD: 4 };

  function normalizeLevel(token) {
    const t = token.toLowerCase().replace(/[.\s']/g, '');
    if (/^assoc/.test(t)) return "Associate's";
    if (/^(bachelors?|bsc?|ba|be|btech)$/.test(t)) return "Bachelor's";
    if (/^(masters?|msc?|ma|meng|mtech|mba)$/.test(t)) return "Master's";
    if (/^(phd|doctorate|doctoral)$/.test(t)) return 'PhD';
    return null;
  }

  function cleanField(raw) {
    if (!raw) return null;
    const field = raw
      .replace(/\s+/g, ' ')
      .replace(/\s+(?:or|and)$/i, '')
      .replace(/[,\s]+$/, '')
      .trim();
    if (field.length < 2) return null;
    // Title-case a field that arrived shouting, leave normal casing alone.
    return field === field.toUpperCase() && field.length > 3
      ? field.charAt(0) + field.slice(1).toLowerCase()
      : field;
  }

  function extractEducation(sections) {
    const hits = [];

    for (const section of sections) {
      const text = section.text;
      for (const re of [EDU_WORD_RE, EDU_ABBR_RE, EDU_AMBIGUOUS_ABBR_RE]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          const level = normalizeLevel(m[1]);
          if (!level) continue;
          const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 100);
          hits.push({
            level: level,
            rank: LEVEL_RANK[level],
            field: cleanField(m[2]),
            equivalentOk: EQUIVALENT_RE.test(tail),
            required: section.type === 'required'
          });
        }
      }
    }

    if (hits.length === 0) return null;

    // The bar is the lowest acceptable degree, and a required section beats a
    // preferred one when both name a degree.
    const pool = hits.some((h) => h.required) ? hits.filter((h) => h.required) : hits;
    pool.sort((a, b) => a.rank - b.rank);
    const best = pool[0];

    return {
      level: best.level,
      field: best.field,
      equivalentOk: hits.some((h) => h.level === best.level && h.equivalentOk)
    };
  }

  function withYears(names, perSkill) {
    return names.map((name) => ({
      name: name,
      years: Object.prototype.hasOwnProperty.call(perSkill, name) ? perSkill[name] : null
    }));
  }

  function extract(text) {
    const sections = usableSections(splitSections(text));
    const skills = extractSkills(sections);
    const years = extractYears(sections);
    const education = extractEducation(sections);

    const skillsRequired = withYears(skills.required, years.perSkill);
    const skillsPreferred = withYears(skills.preferred, years.perSkill);

    return {
      years: years.headline,
      skillsRequired: skillsRequired,
      skillsPreferred: skillsPreferred,
      education: education,
      // Education is still extracted and returned, but the card no longer shows
      // it, so it must not keep an otherwise-empty card alive.
      empty:
        years.headline === null &&
        skillsRequired.length === 0 &&
        skillsPreferred.length === 0
    };
  }

  root.LJSExtractor = {
    splitSections: splitSections,
    usableSections: usableSections,
    extractSkills: extractSkills,
    extractYears: extractYears,
    extractEducation: extractEducation,
    extract: extract
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSExtractor;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

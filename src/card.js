(function (root) {
  'use strict';

  const doc = root.document;

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function line(card, className) {
    const node = el('div', 'ljs-card__line' + (className ? ' ' + className : ''));
    card.appendChild(node);
    return node;
  }

  function addTags(parent, skills, preferred) {
    for (const skill of skills) {
      const tag = el('span', 'ljs-card__tag' + (preferred ? ' ljs-card__tag--preferred' : ''));
      tag.appendChild(doc.createTextNode(skill.name));
      if (skill.years != null) {
        tag.appendChild(el('span', 'ljs-card__tag-years', ' ' + skill.years + '+y'));
      }
      parent.appendChild(tag);
    }
  }

  const PERIOD_LABEL = {
    day: 'today',
    '24 hours': 'today',
    week: 'this week',
    month: 'this month'
  };

  function applicantsText(applicants) {
    let text = applicants.total.toLocaleString() + ' applied';
    if (applicants.recent != null) {
      text += ' · ' + applicants.recent.toLocaleString() +
        ' ' + (PERIOD_LABEL[applicants.period] || 'recently');
    }
    return text;
  }

  // "5+ years" is the extractor's wording. The card is deliberately short.
  function shortYears(label) {
    return label.replace(/\byears\b/, 'yrs').replace(/\byear\b/, 'yr');
  }

  function shell(extraClass) {
    const card = el('div', 'ljs-card' + (extraClass ? ' ' + extraClass : ''));
    card.setAttribute('data-ljs-card', 'true');
    return card;
  }

  function render(summary) {
    // The applicant count is worth a card on its own, so a posting with no
    // readable requirements is not empty when the count is present.
    const applicants = summary && summary.applicants;
    if (!summary || (summary.empty && !applicants)) {
      return renderError('No skills or experience requirements found.');
    }
    const card = shell(null);

    // Years and required skills share one line. Years leads, as a filled chip,
    // because it is the fastest disqualifier and should be the first thing read.
    // The applicant count sits beside it: it is context about the job rather
    // than a requirement of it, so it gets its own colour.
    if (summary.years || applicants || summary.skillsRequired.length) {
      const first = line(card, null);
      if (summary.years) {
        first.appendChild(el('span', 'ljs-card__yrs', shortYears(summary.years.label)));
      }
      if (applicants) {
        const chip = el('span', 'ljs-card__apps', applicantsText(applicants));
        chip.title = 'From the LinkedIn Premium panel on this page.';
        first.appendChild(chip);
      }
      addTags(first, summary.skillsRequired, false);
    }

    if (summary.skillsPreferred.length) {
      const second = line(card, null);
      second.appendChild(el('span', 'ljs-card__hint', 'nice to have'));
      addTags(second, summary.skillsPreferred, true);
    }

    return card;
  }

  function renderError(message) {
    const card = shell('ljs-card--error');
    line(card, null).appendChild(doc.createTextNode(message));
    return card;
  }

  root.LJSCard = { render: render, renderError: renderError };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSCard;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

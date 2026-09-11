(function (root) {
  'use strict';

  const doc = root.document;

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function tagList(skills, preferred) {
    const wrap = el('span');
    for (const skill of skills) {
      const tag = el('span', 'ljs-card__tag' + (preferred ? ' ljs-card__tag--preferred' : ''));
      tag.appendChild(doc.createTextNode(skill.name));
      if (skill.years != null) {
        const yrs = el('span', 'ljs-card__tag-years', ' ' + skill.years + '+y');
        tag.appendChild(yrs);
      }
      wrap.appendChild(tag);
    }
    return wrap;
  }

  function row(parent, label, valueNode) {
    const r = el('div', 'ljs-card__row');
    r.appendChild(el('span', 'ljs-card__label', label));
    const value = el('span', 'ljs-card__value');
    value.appendChild(valueNode);
    r.appendChild(value);
    parent.appendChild(r);
  }

  function educationText(edu) {
    let text = edu.level;
    if (edu.field) text += ' in ' + edu.field;
    if (edu.equivalentOk) text += ' (or equivalent experience)';
    return text;
  }

  function shell(extraClass) {
    const card = el('div', 'ljs-card' + (extraClass ? ' ' + extraClass : ''));
    card.setAttribute('data-ljs-card', 'true');
    card.appendChild(el('div', 'ljs-card__title', 'Quick summary'));
    return card;
  }

  function render(summary) {
    if (!summary || summary.empty) {
      return renderError('No skills or experience requirements found in this posting.');
    }
    const card = shell(null);
    if (summary.years) {
      row(card, 'Experience', doc.createTextNode(summary.years.label));
    }
    if (summary.skillsRequired.length) {
      row(card, 'Required', tagList(summary.skillsRequired, false));
    }
    if (summary.skillsPreferred.length) {
      row(card, 'Preferred', tagList(summary.skillsPreferred, true));
    }
    if (summary.education) {
      row(card, 'Education', doc.createTextNode(educationText(summary.education)));
    }
    return card;
  }

  function renderError(message) {
    const card = shell('ljs-card--error');
    row(card, 'Status', doc.createTextNode(message));
    return card;
  }

  root.LJSCard = { render: render, renderError: renderError };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSCard;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

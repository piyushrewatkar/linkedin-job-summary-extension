(function (root) {
  'use strict';

  const doc = root.document;
  const CARD_ATTR = 'data-ljs-card';

  // Tried in order. LinkedIn renames classes without notice, so this is layered
  // rather than a single selector.
  const DESCRIPTION_SELECTORS = [
    '.jobs-description__content',
    '#job-details',
    '.jobs-box__html-content',
    '.show-more-less-html__markup',
    '.jobs-description-content__text'
  ];

  const PANE_SELECTORS = [
    '.jobs-search__job-details',
    '.job-view-layout',
    '.jobs-details',
    'main'
  ];

  function firstMatch(selectors) {
    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  // Last resort: the biggest text block inside the details pane.
  function largestTextBlock(pane) {
    if (!pane) return null;
    let best = null;
    let bestLength = 400; // below this it is chrome, not a description
    const candidates = pane.querySelectorAll('div, section, article');
    for (const node of candidates) {
      if (node.querySelector('[' + CARD_ATTR + ']')) continue;
      const length = (node.innerText || '').trim().length;
      if (length > bestLength) {
        bestLength = length;
        best = node;
      }
    }
    return best;
  }

  function findDescription() {
    return firstMatch(DESCRIPTION_SELECTORS) || largestTextBlock(firstMatch(PANE_SELECTORS));
  }

  function hashOf(text) {
    let h = 0;
    const sample = text.slice(0, 200);
    for (let i = 0; i < sample.length; i += 1) {
      h = (h * 31 + sample.charCodeAt(i)) | 0;
    }
    return 'h' + h;
  }

  function jobKey(descriptionText) {
    const params = new URLSearchParams(root.location.search);
    const current = params.get('currentJobId');
    if (current) return 'id' + current;
    const viewMatch = root.location.pathname.match(/\/jobs\/view\/(\d+)/);
    if (viewMatch) return 'id' + viewMatch[1];
    return hashOf(descriptionText);
  }

  let lastKey = null;

  function update() {
    const description = findDescription();

    if (!description) {
      lastKey = null;
      return;
    }

    const text = description.innerText || '';
    if (text.trim().length < 40) return; // pane still loading

    const key = jobKey(text);
    const existing = doc.querySelector('[' + CARD_ATTR + ']');
    if (key === lastKey && existing) return;

    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    let card;
    try {
      card = root.LJSCard.render(root.LJSExtractor.extract(text));
    } catch (err) {
      card = root.LJSCard.renderError('Could not read this posting.');
    }

    const anchor = description.parentNode ? description : null;
    if (!anchor || !anchor.parentNode) return;
    anchor.parentNode.insertBefore(card, anchor);
    lastKey = key;
  }

  let pending = null;
  function schedule() {
    if (pending) return;
    pending = root.setTimeout(function () {
      pending = null;
      update();
    }, 250);
  }

  const observer = new root.MutationObserver(schedule);
  observer.observe(doc.body, { childList: true, subtree: true });

  // LinkedIn is a single page app; history moves do not always mutate immediately.
  root.addEventListener('popstate', schedule);
  schedule();
})(typeof globalThis !== 'undefined' ? globalThis : this);

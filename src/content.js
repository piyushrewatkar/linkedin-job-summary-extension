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

  const MIN_PANE_TEXT = 800;

  const TOP_CARD_SELECTORS = [
    '.job-details-jobs-unified-top-card__container--two-pane',
    '.job-details-jobs-unified-top-card',
    '.jobs-unified-top-card',
    '.jobs-details-top-card'
  ];

  function firstMatch(selectors, root) {
    const scope = root || doc;
    for (const selector of selectors) {
      const node = scope.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  // LinkedIn's filter bar carries four buttons labelled "Apply current filter to
  // show results", and they sit above the job in the page. Matching one of those
  // is what put the card at the top of the window. The job's own control is
  // recognisable by its class or by an aria-label naming the job.
  function isApplyControl(node) {
    if (/jobs-apply-button/.test(String(node.className || ''))) return true;
    const aria = node.getAttribute('aria-label') || '';
    const text = (node.innerText || '').trim();
    if (/\bfilter|show results|autofill/i.test(aria + ' ' + text)) return false;
    if (/^apply to\b/i.test(aria)) return true;
    return /^(easy\s+)?apply(\s+now)?$/i.test(text);
  }

  function applyControl(root) {
    const nodes = (root || doc).querySelectorAll(
      '.jobs-apply-button, button, a[role="button"]'
    );
    for (const node of nodes) {
      if (isApplyControl(node)) return node;
    }
    return null;
  }

  function hasResultsList(node) {
    return Boolean(
      node &&
        node.querySelector(
          '.scaffold-layout__list, .jobs-search-results-list, .jobs-search-results__list'
        )
    );
  }

  // The job pane is the nearest ancestor of the Apply control holding a
  // substantial amount of text. Climbing from the control cannot reach the
  // results list, which is what a page-wide selector kept doing.
  function jobPane() {
    const apply = applyControl(doc);
    if (apply) {
      let node = apply.parentElement;
      while (node && node !== doc.body) {
        if ((node.innerText || '').trim().length >= MIN_PANE_TEXT) return node;
        node = node.parentElement;
      }
    }
    return firstMatch(PANE_SELECTORS);
  }

  // Last resort: descend to the tightest wrapper around the pane's text. A plain
  // maximum cannot work, because an ancestor always holds at least as much text
  // as its child and would always win.
  function largestTextBlock(pane) {
    if (!pane || hasResultsList(pane)) return null; // never read the results list
    let node = pane;
    let length = (node.innerText || '').trim().length;
    if (length < 400) return null;
    for (;;) {
      let next = null;
      for (const child of node.children) {
        if (child.hasAttribute(CARD_ATTR)) continue;
        const childLength = (child.innerText || '').trim().length;
        if (childLength >= length * 0.9) {
          next = child;
          length = childLength;
          break;
        }
      }
      if (!next) return node;
      node = next;
    }
  }

  function findDescription(pane) {
    return (
      firstMatch(DESCRIPTION_SELECTORS, pane) ||
      firstMatch(DESCRIPTION_SELECTORS) ||
      largestTextBlock(pane)
    );
  }

  // The header is the outermost block inside the pane that holds the Apply
  // control but not the description, so the card lands directly beneath the
  // Apply and Save buttons.
  function headerBlock(pane, description) {
    if (!pane || !description) return null;
    const apply = applyControl(pane);
    const anchor = apply || firstMatch(['h1', 'h2', 'h3'], pane);
    if (!anchor || description.contains(anchor)) return null;

    for (const selector of TOP_CARD_SELECTORS) {
      const known = pane.querySelector(selector);
      if (known && !known.contains(description) && known.contains(anchor)) return known;
    }

    let node = anchor;
    while (
      node.parentElement &&
      node.parentElement !== pane &&
      !node.parentElement.contains(description)
    ) {
      node = node.parentElement;
    }
    return node.parentElement ? node : null;
  }

  function hashOf(text) {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) {
      h = (h * 31 + text.charCodeAt(i)) | 0;
    }
    return 'h' + h;
  }

  // The text hash is part of the key, not a fallback. LinkedIn updates the URL
  // before it swaps the pane content, so keying on the id alone lets a card
  // built from the previous job's text be treated as current and never replaced.
  function jobKey(descriptionText) {
    const params = new URLSearchParams(root.location.search);
    const current = params.get('currentJobId');
    const viewMatch = root.location.pathname.match(/\/jobs\/view\/(\d+)/);
    const id = current || (viewMatch ? viewMatch[1] : 'none');
    return 'id' + id + ':' + hashOf(descriptionText);
  }

  let lastKey = null;

  // The script is injected across linkedin.com because a content script only
  // loads with the document, and LinkedIn routes client side: arriving at
  // /jobs/ from the feed never triggered an injection. It does nothing at all
  // on any other section.
  function onJobsPage() {
    return root.location.pathname.indexOf('/jobs/') === 0;
  }

  function update() {
    if (!onJobsPage()) {
      lastKey = null;
      return;
    }
    const pane = jobPane();
    const description = findDescription(pane);

    if (!description) {
      lastKey = null;
      const paneText = pane ? (pane.innerText || '').trim() : '';
      // Substantial content is present but no selector matched it, which means
      // LinkedIn's markup moved. Say so rather than vanish silently.
      if (paneText.length > 400 && !doc.querySelector('[' + CARD_ATTR + ']')) {
        pane.insertBefore(
          root.LJSCard.renderError('Could not find the job description on this page.'),
          pane.firstChild
        );
      }
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
      const summary = root.LJSExtractor.extract(text);
      // The Premium applicant panel sits outside the description element, so it
      // is read from the whole details pane. On a free account the panel is not
      // in the page at all and this simply comes back null.
      summary.applicants = root.LJSApplicants.parse(pane ? pane.innerText || '' : text);
      // The panel is not always inside the pane a given layout reports. Falling
      // back to the whole page is safe because the heading it looks for is
      // specific, and a miss simply leaves the figure off the card.
      if (!summary.applicants && doc.body) {
        summary.applicants = root.LJSApplicants.parse(doc.body.innerText || '');
      }
      card = root.LJSCard.render(summary);
    } catch (err) {
      card = root.LJSCard.renderError('Could not read this posting.');
    }

    const header = headerBlock(pane, description);
    if (header && header.parentNode) {
      header.parentNode.insertBefore(card, header.nextSibling);
    } else {
      // No header found: fall back to sitting above the description, which is
      // where the card used to live and is still better than not showing.
      if (!description.parentNode) return;
      description.parentNode.insertBefore(card, description);
    }
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

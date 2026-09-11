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

  const TOP_CARD_SELECTORS = [
    '.job-details-jobs-unified-top-card__container--two-pane',
    '.job-details-jobs-unified-top-card',
    '.jobs-unified-top-card',
    '.jobs-details-top-card'
  ];

  function firstMatch(selectors) {
    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  // Last resort: descend to the tightest wrapper around the pane's text. A plain
  // maximum cannot work, because an ancestor always holds at least as much text
  // as its child and would always win. Descending also touches a handful of
  // nodes rather than every node in the pane.
  function largestTextBlock(pane) {
    if (!pane) return null;
    let node = pane;
    let length = (node.innerText || '').trim().length;
    if (length < 400) return null; // below this it is chrome, not a description
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

  function findDescription() {
    return firstMatch(DESCRIPTION_SELECTORS) || largestTextBlock(firstMatch(PANE_SELECTORS));
  }

  // Anchored on the Apply control rather than on a heading. Two earlier
  // attempts keyed off the job title, and the title is not reliably an h1 or h2
  // in this layout, so the search walked past the details pane and landed on a
  // page-level heading in a full-width container. The Apply button is
  // unmistakable, and it is exactly where the card is wanted: just below it.
  function applyControl(root, description) {
    const nodes = root.querySelectorAll(
      '.jobs-apply-button, button, a[role="button"], a[class*="apply"]'
    );
    for (const node of nodes) {
      if (description.contains(node)) continue;
      const label =
        (node.getAttribute('aria-label') || '') + ' ' + (node.innerText || '');
      if (/(^|\s)(easy\s+)?apply(\s|$)/i.test(label) || /\bapply\s+to\b/i.test(label)) {
        return node;
      }
    }
    return null;
  }

  function headingOutside(root, description) {
    const headings = root.querySelectorAll('h1, h2, h3');
    for (const heading of headings) {
      if (!description.contains(heading)) return heading;
    }
    return null;
  }

  // The details pane is the nearest ancestor of the description that also holds
  // the job's own Apply control, or failing that a heading. It cannot be the
  // results list, because the description is not inside the results list.
  function detailRoot(description) {
    let node = description.parentElement;
    while (node && node !== doc.body) {
      const anchor =
        applyControl(node, description) || headingOutside(node, description);
      if (anchor) return { root: node, anchor: anchor };
      node = node.parentElement;
    }
    return null;
  }

  // The header is the outermost block inside that root holding the anchor but
  // not the description. Structure rather than class names, so a LinkedIn
  // rename does not move the card.
  function headerBlock(description) {
    const found = detailRoot(description);
    if (!found) return null;

    for (const selector of TOP_CARD_SELECTORS) {
      const known = found.root.querySelector(selector);
      if (known && !known.contains(description) && known.contains(found.anchor)) {
        return known;
      }
    }

    let node = found.anchor;
    while (
      node.parentElement &&
      node.parentElement !== found.root &&
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
    const description = findDescription();

    if (!description) {
      lastKey = null;
      const pane = firstMatch(PANE_SELECTORS);
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

    const pane = firstMatch(PANE_SELECTORS);

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

    const header = headerBlock(description);
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

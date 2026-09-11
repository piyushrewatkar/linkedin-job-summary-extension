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

    let card;
    try {
      const summary = root.LJSExtractor.extract(text);
      // The Premium applicant panel sits outside the description element, so it
      // is read from the whole details pane. On a free account the panel is not
      // in the page at all and this simply comes back null.
      const pane = firstMatch(PANE_SELECTORS);
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

    if (!description.parentNode) return;
    description.parentNode.insertBefore(card, description);
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

import "@testing-library/jest-dom/vitest";

// jsdom does not implement Element.scrollTo; AiAssistant scrolls the message pane.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {
    /* no-op in unit tests */
  };
}

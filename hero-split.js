/* ============================================================
   SplitText — hero title loading animation.
   Ported from the React Bits "SplitText" (gsap) component to
   plain JS + CSS: splits the H1 into words/characters (preserving
   the inline .hl highlight) and reveals each char with a staggered
   rise + fade on load. Skipped for prefers-reduced-motion and for
   automation/headless (title stays fully visible for screenshots).
   ============================================================ */
(function () {
  "use strict";

  var h1 = document.querySelector(".hero__title");
  if (!h1) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var automated = navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);
  if (reduced || automated) return; // leave the title as plain, fully-visible text

  var chars = [];

  function wrapText(text, parent) {
    // keep whitespace tokens so line-wrapping stays natural
    var tokens = text.split(/(\s+)/);
    tokens.forEach(function (token) {
      if (token === "") return;
      if (/^\s+$/.test(token)) {
        parent.appendChild(document.createTextNode(token));
        return;
      }
      var word = document.createElement("span");
      word.className = "split-word";
      // split by Unicode code points (safe for š, č, ć, ž, đ)
      var letters = Array.from(token);
      letters.forEach(function (ch) {
        var c = document.createElement("span");
        c.className = "split-char";
        c.textContent = ch;
        word.appendChild(c);
        chars.push(c);
      });
      parent.appendChild(word);
    });
  }

  var frag = document.createDocumentFragment();
  Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
    if (node.nodeType === 3) {
      wrapText(node.textContent, frag);
    } else if (node.nodeType === 1) {
      var clone = node.cloneNode(false); // keep tag + classes (e.g. .hl)
      wrapText(node.textContent, clone);
      frag.appendChild(clone);
    }
  });

  h1.textContent = "";
  h1.appendChild(frag);
  h1.classList.add("split-ready");

  var stagger = 26; // ms between letters
  chars.forEach(function (c, i) { c.style.transitionDelay = (i * stagger) + "ms"; });

  // double rAF so the initial (hidden) state paints before transitioning in
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { h1.classList.add("split-in"); });
  });
})();

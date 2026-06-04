/* ============================================================
   Injects a subtle white dot-grid into each testimonial card and
   makes it light up near the cursor on hover (a lightweight CSS-mask
   take on the "3 greške" DotGrid — no per-card canvas/rAF).
   ============================================================ */
(function () {
  "use strict";

  var cards = document.querySelectorAll(".vcard");
  if (!cards.length) return;

  Array.prototype.forEach.call(cards, function (card) {
    var dots = document.createElement("div");
    dots.className = "vcard__dots";
    dots.setAttribute("aria-hidden", "true");
    card.insertBefore(dots, card.firstChild);

    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
    });
  });
})();

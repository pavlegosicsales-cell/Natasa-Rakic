/* ============================================================
   Bonus cards — benefits collapsed by default; "Više" expands the
   card to reveal the bullet list (and collapses back to "Manje").
   ============================================================ */
(function () {
  "use strict";
  document.querySelectorAll(".bonus-card__toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".bonus-card");
      if (!card) return;
      var open = card.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      var label = btn.querySelector(".bonus-card__label");
      if (label) label.textContent = open ? "Manje" : "Više";
    });
  });
})();

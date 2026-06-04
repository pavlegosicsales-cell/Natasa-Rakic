/* ============================================================
   MagicBento glow — bonus cards light up their border + inner
   spotlight toward the cursor. Ported from React Bits "MagicBento"
   to plain JS (no gsap): border-glow + spotlight only, no particles,
   no tilt/magnetism. Brand magenta. Disabled on touch/mobile and
   for prefers-reduced-motion (cards keep their clean static look).
   ============================================================ */
(function () {
  "use strict";

  var grid = document.querySelector(".bonus-grid");
  if (!grid) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (reduced || coarse || window.innerWidth <= 768) return;

  var RADIUS = 280;
  var proximity = RADIUS * 0.5;
  var fadeDistance = RADIUS * 0.75;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".bonus-card"));
  if (!cards.length) return;

  var raf = null, lastEvent = null;

  function update() {
    raf = null;
    var e = lastEvent;
    if (!e) return;
    cards.forEach(function (card) {
      var r = card.getBoundingClientRect();
      var relX = ((e.clientX - r.left) / r.width) * 100;
      var relY = ((e.clientY - r.top) / r.height) * 100;
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dist = Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(r.width, r.height) / 2;
      dist = Math.max(0, dist);

      var intensity = 0;
      if (dist <= proximity) intensity = 1;
      else if (dist <= fadeDistance) intensity = (fadeDistance - dist) / (fadeDistance - proximity);

      card.style.setProperty("--glow-x", relX + "%");
      card.style.setProperty("--glow-y", relY + "%");
      card.style.setProperty("--glow-intensity", intensity.toFixed(3));
    });
  }

  document.addEventListener("mousemove", function (e) {
    lastEvent = e;
    if (!raf) raf = requestAnimationFrame(update);
  }, { passive: true });

  document.addEventListener("mouseleave", function () {
    cards.forEach(function (card) { card.style.setProperty("--glow-intensity", "0"); });
  });
})();

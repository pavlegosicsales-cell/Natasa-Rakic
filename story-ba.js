/* ============================================================
   Before/After slider — drag (or arrow-key) to wipe between the
   "PRE" photo and the "DANAS" photo. Pointer + touch + keyboard,
   no dependencies. Supports multiple sliders on one page.
   ============================================================ */
(function () {
  "use strict";

  Array.prototype.slice.call(document.querySelectorAll("[data-ba]")).forEach(function (ba) {
    var dragging = false;

    function setPos(pct) {
      pct = Math.max(0, Math.min(100, pct));
      ba.style.setProperty("--pos", pct + "%");
      ba.setAttribute("aria-valuenow", Math.round(pct));
    }
    function posFromEvent(e) {
      var rect = ba.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return (x / rect.width) * 100;
    }
    function onDown(e) {
      dragging = true;
      ba.classList.add("ba--touched");
      setPos(posFromEvent(e));
      if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      setPos(posFromEvent(e));
      if (e.cancelable) e.preventDefault();
    }
    function onUp() { dragging = false; }

    ba.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    ba.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    ba.addEventListener("keydown", function (e) {
      var cur = parseFloat(ba.getAttribute("aria-valuenow")) || 50;
      if (e.key === "ArrowLeft") { ba.classList.add("ba--touched"); setPos(cur - 4); e.preventDefault(); }
      else if (e.key === "ArrowRight") { ba.classList.add("ba--touched"); setPos(cur + 4); e.preventDefault(); }
    });
  });
})();

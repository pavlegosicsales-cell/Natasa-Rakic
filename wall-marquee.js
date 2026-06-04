/* ============================================================
   Testimonials marquee — splits the message wall into up to 3
   vertical columns that auto-scroll at different speeds (ported
   from the 21st.dev "testimonial-v2" effect to plain JS/CSS, brand
   colors). Each column's cards are duplicated once for a seamless
   loop. Hovering a column pauses it. Reduced motion → static stack.
   The lightbox delegation on .wall keeps working (cols stay inside).
   ============================================================ */
(function () {
  "use strict";

  var wall = document.querySelector(".wall");
  if (!wall) return;

  var cards = Array.prototype.slice.call(wall.querySelectorAll(".wall-card"));
  if (cards.length < 2) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COLS = 3;

  var cols = document.createElement("div");
  cols.className = "wall-cols";
  var tracks = [];
  for (var i = 0; i < COLS; i++) {
    var col = document.createElement("div");
    col.className = "wall-col wall-col--" + (i + 1);
    var track = document.createElement("div");
    track.className = "wall-track" + (reduced ? "" : " wall-track--anim");
    col.appendChild(track);
    cols.appendChild(col);
    tracks.push(track);
  }

  cards.forEach(function (card, idx) {
    card.classList.add("in");      // these were .reveal items — keep them visible
    card.classList.remove("reveal");
    card.style.transition = "";    // clear any inline "transition:none" so hover works
    tracks[idx % COLS].appendChild(card);
  });

  // duplicate each column once for a seamless -50% loop
  if (!reduced) {
    tracks.forEach(function (track) {
      Array.prototype.slice.call(track.children).forEach(function (c) {
        var dup = c.cloneNode(true);
        dup.setAttribute("aria-hidden", "true");
        dup.classList.add("in");
        track.appendChild(dup);
      });
    });
  }

  wall.appendChild(cols);
})();

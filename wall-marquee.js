/* ============================================================
   Testimonials marquee — real message screenshots arranged into
   balanced vertical columns that auto-scroll at a speed matched to
   their length (ported from the 21st.dev "testimonial-v2" effect to
   plain JS/CSS, brand colors). Column count adapts to viewport so
   ALL messages stay visible on mobile (1 col), tablet (2), desktop (3).
   Each column is duplicated once for a seamless loop; hover pauses it.
   Reduced motion → static stack. Lightbox delegation on .wall still works.
   ============================================================ */
(function () {
  "use strict";

  var wall = document.querySelector(".wall");
  if (!wall) return;

  var originals = Array.prototype.slice.call(wall.querySelectorAll(".wall-card"));
  if (originals.length < 2) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  originals.forEach(function (card) {
    card.classList.add("in");
    card.classList.remove("reveal");
    card.style.transition = "";
    if (card.parentNode) card.parentNode.removeChild(card);
  });

  function colsForWidth() {
    var w = window.innerWidth;
    if (w >= 1000) return 3;
    if (w >= 640) return 2;
    return 1;
  }

  function ratioOf(card) {
    var img = card.querySelector("img");
    var w = img && parseFloat(img.getAttribute("width"));
    var h = img && parseFloat(img.getAttribute("height"));
    return (w && h) ? (h / w) : 1.2; // height per unit width
  }

  var built = -1;

  function build(cols) {
    built = cols;
    // clear previous structure
    var old = wall.querySelector(".wall-cols");
    if (old) wall.removeChild(old);

    var wrap = document.createElement("div");
    wrap.className = "wall-cols";
    var tracks = [], heights = [];
    for (var i = 0; i < cols; i++) {
      var col = document.createElement("div");
      col.className = "wall-col wall-col--" + (i + 1);
      var track = document.createElement("div");
      track.className = "wall-track" + (reduced ? "" : " wall-track--anim");
      col.appendChild(track);
      wrap.appendChild(col);
      tracks.push(track);
      heights.push(0);
    }

    // greedy balance: each card goes to the currently shortest column
    var counts = new Array(cols).fill(0);
    originals.forEach(function (card) {
      var min = 0;
      for (var i = 1; i < cols; i++) if (heights[i] < heights[min]) min = i;
      tracks[min].appendChild(card);
      heights[min] += ratioOf(card) + 0.14; // + gap allowance
      counts[min]++;
    });

    if (!reduced) {
      tracks.forEach(function (track, i) {
        // speed matched to column length so longer columns don't whip past
        var dur = Math.max(20, counts[i] * 4.2);
        track.style.animationDuration = dur + "s";
        Array.prototype.slice.call(track.children).forEach(function (c) {
          var dup = c.cloneNode(true);
          dup.setAttribute("aria-hidden", "true");
          dup.classList.add("in");
          track.appendChild(dup);
        });
      });
    }

    wall.appendChild(wrap);
  }

  build(colsForWidth());

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var c = colsForWidth();
      if (c !== built) build(c);
    }, 200);
  });
})();

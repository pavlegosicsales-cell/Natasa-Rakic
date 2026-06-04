/* ============================================================
   DotGrid — interactive dot-grid background for the "3 greške"
   section. Ported from the React Bits "DotGrid" (gsap) component
   to plain canvas + a tiny spring integrator (no dependencies):
   dots near the cursor light up in brand colors, get pushed on
   fast movement / click, then spring elastically back home.
   Kept subtle (small dots, dim colors). Skipped for
   prefers-reduced-motion (a static grid is drawn instead).
   ============================================================ */
(function () {
  "use strict";

  var container = document.querySelector(".mistakes__dots");
  if (!container) return;

  // ---- Brand config (subtle, non-distracting) ----
  var dotSize = 4;          // px
  var gap = 26;             // px
  var baseColor = "#3E3040";  // dim warm-dark dot
  var activeColor = "#FF1E8E"; // brand magenta on proximity
  var proximity = 120;      // px reaction radius
  var speedTrigger = 120;   // px/s mouse speed to fling dots
  var shockRadius = 240;    // px click shockwave radius
  var shockStrength = 4;
  var stiffness = 90;       // spring back force
  var damping = 9;          // spring damping (low → elastic feel)

  // Touch / no-cursor devices can't drive the interaction → draw a static grid (saves battery).
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var reduced = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || coarse;

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
  }
  var baseRgb = hexToRgb(baseColor);
  var activeRgb = hexToRgb(activeColor);

  var canvas = document.createElement("canvas");
  container.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var dots = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function buildGrid() {
    var w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cell = dotSize + gap;
    var cols = Math.floor((w + gap) / cell);
    var rows = Math.floor((h + gap) / cell);
    var gridW = cell * cols - gap;
    var gridH = cell * rows - gap;
    var startX = (w - gridW) / 2 + dotSize / 2;
    var startY = (h - gridH) / 2 + dotSize / 2;

    dots = [];
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        dots.push({ cx: startX + x * cell, cy: startY + y * cell, ox: 0, oy: 0, vx: 0, vy: 0 });
      }
    }
  }

  var pr = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, lastT: 0, lastX: 0, lastY: 0, inside: false };
  var proxSq = proximity * proximity;
  var radius = dotSize / 2;

  function drawDot(d) {
    var dx = d.cx - pr.x, dy = d.cy - pr.y;
    var dsq = dx * dx + dy * dy;
    var fill = baseColor;
    if (pr.inside && dsq <= proxSq) {
      var t = 1 - Math.sqrt(dsq) / proximity;
      fill = "rgb(" +
        Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t) + "," +
        Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t) + "," +
        Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t) + ")";
    }
    ctx.beginPath();
    ctx.arc(d.cx + d.ox, d.cy + d.oy, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawStatic() {
    var w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) drawDot(dots[i]);
  }

  var rafId = null, running = false, lastFrame = 0;
  function frame(now) {
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016;
    lastFrame = now;
    var w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      // spring toward home (0,0 offset) with damping
      var ax = -stiffness * d.ox - damping * d.vx;
      var ay = -stiffness * d.oy - damping * d.vy;
      d.vx += ax * dt; d.vy += ay * dt;
      d.ox += d.vx * dt; d.oy += d.vy * dt;
      drawDot(d);
    }
    rafId = requestAnimationFrame(frame);
  }
  function start() { if (running || reduced) return; running = true; lastFrame = 0; rafId = requestAnimationFrame(frame); }
  function stop() { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  function localPoint(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, inX: e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom };
  }

  function onMove(e) {
    var now = performance.now();
    var dt = pr.lastT ? now - pr.lastT : 16;
    var p = localPoint(e);
    pr.inside = p.inX;
    var dx = e.clientX - pr.lastX, dy = e.clientY - pr.lastY;
    var vx = (dx / dt) * 1000, vy = (dy / dt) * 1000;
    var speed = Math.hypot(vx, vy);
    pr.lastT = now; pr.lastX = e.clientX; pr.lastY = e.clientY;
    pr.x = p.x; pr.y = p.y; pr.speed = speed;
    if (!p.inX || speed <= speedTrigger) return;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var dist = Math.hypot(d.cx - pr.x, d.cy - pr.y);
      if (dist < proximity) {
        var f = 1 - dist / proximity;
        d.vx += (d.cx - pr.x) * 0.18 * f + vx * 0.012 * f;
        d.vy += (d.cy - pr.y) * 0.18 * f + vy * 0.012 * f;
      }
    }
  }

  function onClick(e) {
    var p = localPoint(e);
    if (!p.inX) return;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var dist = Math.hypot(d.cx - p.x, d.cy - p.y);
      if (dist < shockRadius) {
        var falloff = Math.max(0, 1 - dist / shockRadius);
        d.vx += (d.cx - p.x) * shockStrength * falloff;
        d.vy += (d.cy - p.y) * shockStrength * falloff;
      }
    }
  }

  // throttle mousemove a touch
  var lastMove = 0;
  function throttledMove(e) {
    var now = performance.now();
    if (now - lastMove < 32) { pr.lastX = e.clientX; pr.lastY = e.clientY; return; }
    lastMove = now;
    onMove(e);
  }

  buildGrid();
  if (reduced) {
    drawStatic();
  } else {
    window.addEventListener("mousemove", throttledMove, { passive: true });
    window.addEventListener("click", onClick);
    window.addEventListener("mouseout", function () { pr.inside = false; });
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { buildGrid(); if (reduced) drawStatic(); }, 150);
  });

  // Run only while the section is on screen
  if (!reduced && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }, { threshold: 0.02 }).observe(container);
  } else {
    start();
  }
})();

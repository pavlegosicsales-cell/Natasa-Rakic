/* ============================================================
   Ambient aurora — softly drifting brand-color orbs behind the
   newsletter section. Ported from the 21st.dev "ambient-aurora"
   canvas to plain JS, scoped to the section (not the window),
   tuned subtle so text stays readable on the light background.
   Runs only while on screen; static single frame for reduced motion.
   ============================================================ */
(function () {
  "use strict";

  var host = document.querySelector(".nl-aurora");
  if (!host) return;

  var canvas = document.createElement("canvas");
  host.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Brand palette (magenta, yellow, orange, soft pink)
  var colors = [
    { r: 255, g: 30, b: 142 },
    { r: 232, g: 255, b: 58 },
    { r: 255, g: 106, b: 0 },
    { r: 255, g: 120, b: 180 }
  ];

  var dpr = 1, W = 0, H = 0, orbs = [], time = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeOrbs() {
    var n = 7;
    var base = Math.min(W, H);
    orbs = [];
    for (var i = 0; i < n; i++) {
      orbs.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(base * 0.35, base * 0.75),
        c: colors[i % colors.length],
        vx: rand(-0.25, 0.25),
        vy: rand(-0.25, 0.25)
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = host.clientWidth; H = host.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!orbs.length) makeOrbs();
  }

  function drawOrb(o) {
    var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    g.addColorStop(0, "rgba(" + o.c.r + "," + o.c.g + "," + o.c.b + ",0.34)");
    g.addColorStop(1, "rgba(" + o.c.r + "," + o.c.g + "," + o.c.b + ",0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function render(animateMotion) {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      if (animateMotion) {
        o.x += o.vx + Math.sin(time * 0.001) * 0.35;
        o.y += o.vy + Math.cos(time * 0.001) * 0.35;
        if (o.x < -o.r || o.x > W + o.r || o.y < -o.r || o.y > H + o.r) {
          o.x = Math.random() * W; o.y = Math.random() * H;
        }
      }
      drawOrb(o);
    }
  }

  var rafId = null, running = false;
  function frame() { time++; render(true); rafId = requestAnimationFrame(frame); }
  function start() { if (running || reduced) return; running = true; rafId = requestAnimationFrame(frame); }
  function stop() { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  resize();
  window.addEventListener("resize", function () { resize(); if (reduced) render(false); });

  if (reduced) {
    render(false);
  } else if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { if (e[0].isIntersecting) start(); else stop(); }, { threshold: 0.02 }).observe(host);
  } else {
    start();
  }
})();

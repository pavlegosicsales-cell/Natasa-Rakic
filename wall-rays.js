/* ============================================================
   LightRays — top-center light rays behind the testimonials wall.
   Ported from the React Bits "LightRays" (ogl) component to plain
   WebGL: same GLSL shader, brand magenta, zero dependencies.
   Renders only while the section is on screen; skipped for
   prefers-reduced-motion. Subtle, behind the content.
   ============================================================ */
(function () {
  "use strict";

  var container = document.querySelector(".wall-rays");
  if (!container) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  container.appendChild(canvas);
  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) return;

  // ---- config (brand colors) ----
  var RAYS_COLOR = "#FF1E8E";   // brand magenta
  var raysSpeed = 1.0;
  var lightSpread = 0.7;
  var rayLength = 2.4;
  var pulsating = 0.0;
  var fadeDistance = 1.0;
  var saturation = 1.0;
  var mouseInfluence = 0.12;
  var noiseAmount = 0.06;
  var distortion = 0.03;

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
  }

  var vert =
    "attribute vec2 position;" +
    "void main(){ gl_Position = vec4(position, 0.0, 1.0); }";

  var frag = [
    "precision highp float;",
    "uniform float iTime; uniform vec2 iResolution;",
    "uniform vec2 rayPos; uniform vec2 rayDir; uniform vec3 raysColor;",
    "uniform float raysSpeed; uniform float lightSpread; uniform float rayLength;",
    "uniform float pulsating; uniform float fadeDistance; uniform float saturation;",
    "uniform vec2 mousePos; uniform float mouseInfluence; uniform float noiseAmount; uniform float distortion;",
    "float noise(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123); }",
    "float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed){",
    "  vec2 sourceToCoord = coord - raySource;",
    "  vec2 dirNorm = normalize(sourceToCoord);",
    "  float cosAngle = dot(dirNorm, rayRefDirection);",
    "  float distortedAngle = cosAngle + distortion * sin(iTime*2.0 + length(sourceToCoord)*0.01)*0.2;",
    "  float spreadFactor = pow(max(distortedAngle,0.0), 1.0/max(lightSpread,0.001));",
    "  float dist = length(sourceToCoord);",
    "  float maxDistance = iResolution.x * rayLength;",
    "  float lengthFalloff = clamp((maxDistance-dist)/maxDistance, 0.0, 1.0);",
    "  float fadeFalloff = clamp((iResolution.x*fadeDistance-dist)/(iResolution.x*fadeDistance), 0.5, 1.0);",
    "  float pulse = pulsating > 0.5 ? (0.8 + 0.2*sin(iTime*speed*3.0)) : 1.0;",
    "  float baseStrength = clamp((0.45+0.15*sin(distortedAngle*seedA + iTime*speed)) + (0.3+0.2*cos(-distortedAngle*seedB + iTime*speed)), 0.0, 1.0);",
    "  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;",
    "}",
    "void main(){",
    "  vec2 fragCoord = gl_FragCoord.xy;",
    "  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);",
    "  vec2 finalRayDir = rayDir;",
    "  if (mouseInfluence > 0.0){",
    "    vec2 mouseScreenPos = mousePos * iResolution.xy;",
    "    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);",
    "    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));",
    "  }",
    "  vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5*raysSpeed);",
    "  vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1*raysSpeed);",
    "  vec4 fragColor = rays1*0.5 + rays2*0.4;",
    "  if (noiseAmount > 0.0){ float n = noise(coord*0.01 + iTime*0.1); fragColor.rgb *= (1.0 - noiseAmount + noiseAmount*n); }",
    "  float brightness = 1.0 - (coord.y / iResolution.y);",
    "  fragColor.x *= 0.1 + brightness*0.8;",
    "  fragColor.y *= 0.3 + brightness*0.6;",
    "  fragColor.z *= 0.5 + brightness*0.5;",
    "  if (saturation != 1.0){ float gray = dot(fragColor.rgb, vec3(0.299,0.587,0.114)); fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation); }",
    "  fragColor.rgb *= raysColor;",
    "  gl_FragColor = vec4(fragColor.rgb, max(fragColor.r, max(fragColor.g, fragColor.b)));",
    "}"
  ].join("\n");

  function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  gl.useProgram(program);

  var posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  function loc(n) { return gl.getUniformLocation(program, n); }
  var U = {
    iTime: loc("iTime"), iResolution: loc("iResolution"), rayPos: loc("rayPos"), rayDir: loc("rayDir"),
    raysColor: loc("raysColor"), raysSpeed: loc("raysSpeed"), lightSpread: loc("lightSpread"), rayLength: loc("rayLength"),
    pulsating: loc("pulsating"), fadeDistance: loc("fadeDistance"), saturation: loc("saturation"),
    mousePos: loc("mousePos"), mouseInfluence: loc("mouseInfluence"), noiseAmount: loc("noiseAmount"), distortion: loc("distortion")
  };
  gl.uniform3fv(U.raysColor, hexToRgb(RAYS_COLOR));
  gl.uniform1f(U.raysSpeed, raysSpeed);
  gl.uniform1f(U.lightSpread, lightSpread);
  gl.uniform1f(U.rayLength, rayLength);
  gl.uniform1f(U.pulsating, pulsating);
  gl.uniform1f(U.fadeDistance, fadeDistance);
  gl.uniform1f(U.saturation, saturation);
  gl.uniform1f(U.mouseInfluence, mouseInfluence);
  gl.uniform1f(U.noiseAmount, noiseAmount);
  gl.uniform1f(U.distortion, distortion);
  gl.uniform2f(U.mousePos, 0.5, 0.5);

  var dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.iResolution, canvas.width, canvas.height);
    // top-center origin: anchor [0.5w, -0.2h], dir [0,1]
    gl.uniform2f(U.rayPos, 0.5 * canvas.width, -0.2 * canvas.height);
    gl.uniform2f(U.rayDir, 0.0, 1.0);
  }

  var mouse = { x: 0.5, y: 0.5 }, smooth = { x: 0.5, y: 0.5 };
  window.addEventListener("mousemove", function (e) {
    var r = container.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = (e.clientY - r.top) / r.height;
  }, { passive: true });

  var rafId = null, running = false;
  function frame(t) {
    gl.uniform1f(U.iTime, t * 0.001);
    smooth.x = smooth.x * 0.92 + mouse.x * 0.08;
    smooth.y = smooth.y * 0.92 + mouse.y * 0.08;
    gl.uniform2f(U.mousePos, smooth.x, smooth.y);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; resize(); rafId = requestAnimationFrame(frame); }
  function stop() { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }, { threshold: 0.05 }).observe(container);
  } else { start(); }
})();

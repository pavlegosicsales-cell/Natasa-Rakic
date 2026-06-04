/* ============================================================
   SideRays — animated light rays for the hero background.
   Ported from the React Bits "SideRays" (ogl) component to plain
   WebGL: same GLSL shader, brand colors (yellow + magenta),
   zero dependencies. Renders only while the hero is on screen and
   is skipped entirely for prefers-reduced-motion users.
   ============================================================ */
(function () {
  "use strict";

  var container = document.querySelector(".hero__rays");
  if (!container) return;

  // Reduced motion → skip the animated WebGL layer (hero stays clean).
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  container.appendChild(canvas);
  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) return; // no WebGL support → graceful: hero renders without rays

  var vert =
    "attribute vec2 position;" +
    "void main(){ gl_Position = vec4(position, 0.0, 1.0); }";

  var frag = [
    "precision highp float;",
    "uniform float iTime; uniform vec2 iResolution; uniform float iSpeed;",
    "uniform vec3 iRayColor1; uniform vec3 iRayColor2; uniform float iIntensity;",
    "uniform float iSpread; uniform float iFlipX; uniform float iFlipY; uniform float iTilt;",
    "uniform float iSaturation; uniform float iBlend; uniform float iFalloff; uniform float iOpacity;",
    "float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed){",
    "  vec2 sourceToCoord = coord - raySource;",
    "  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);",
    "  return clamp((0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) + (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)), 0.0, 1.0)",
    "    * clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);",
    "}",
    "void main(){",
    "  vec2 fragCoord = gl_FragCoord.xy;",
    "  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;",
    "  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;",
    "  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);",
    "  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);",
    "  float tiltRad = iTilt * 3.14159265 / 180.0;",
    "  float cs = cos(tiltRad); float sn = sin(tiltRad);",
    "  vec2 rel = coord - rayPos;",
    "  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;",
    "  float halfSpread = iSpread * 0.275;",
    "  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));",
    "  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));",
    "  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);",
    "  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);",
    "  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;",
    "  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;",
    "  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);",
    "  color.rgb *= brightness;",
    "  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));",
    "  color.rgb = mix(vec3(gray), color.rgb, iSaturation);",
    "  color.a = max(color.r, max(color.g, color.b)) * iOpacity;",
    "  gl_FragColor = color;",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  var program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  gl.useProgram(program);

  // Full-screen triangle
  var posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  function loc(n) { return gl.getUniformLocation(program, n); }
  var U = {
    iTime: loc("iTime"), iResolution: loc("iResolution"), iSpeed: loc("iSpeed"),
    iRayColor1: loc("iRayColor1"), iRayColor2: loc("iRayColor2"), iIntensity: loc("iIntensity"),
    iSpread: loc("iSpread"), iFlipX: loc("iFlipX"), iFlipY: loc("iFlipY"), iTilt: loc("iTilt"),
    iSaturation: loc("iSaturation"), iBlend: loc("iBlend"), iFalloff: loc("iFalloff"), iOpacity: loc("iOpacity")
  };
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
  }

  // ---- Brand config: top-right origin, yellow + magenta rays ----
  gl.uniform1f(U.iSpeed, 2.0);
  gl.uniform3fv(U.iRayColor1, hexToRgb("#E8FF3A")); // brand yellow
  gl.uniform3fv(U.iRayColor2, hexToRgb("#FF1E8E")); // brand magenta
  gl.uniform1f(U.iIntensity, 1.4);
  gl.uniform1f(U.iSpread, 1.7);
  gl.uniform1f(U.iFlipX, 0); gl.uniform1f(U.iFlipY, 0); // origin: top-right
  gl.uniform1f(U.iTilt, 0);
  gl.uniform1f(U.iSaturation, 1.4);
  gl.uniform1f(U.iBlend, 0.55);
  gl.uniform1f(U.iFalloff, 1.7);
  gl.uniform1f(U.iOpacity, 0.6);

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.iResolution, canvas.width, canvas.height);
  }

  var rafId = null, running = false;
  function frame(t) {
    gl.uniform1f(U.iTime, t * 0.001);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; resize(); rafId = requestAnimationFrame(frame); }
  function stop() { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  window.addEventListener("resize", resize);

  // Render only while the hero is visible (saves battery/GPU when scrolled away)
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }, { threshold: 0.05 }).observe(container);
  } else {
    start();
  }
})();

/* ============================================================
   Signup modal — free signup. One step: Ime + Email.
   On submit → POST { ime, email, listId: 7 } to /api/subscribe.
   No payment, no storage.
   ============================================================ */
(function () {
  "use strict";

  var modal = document.getElementById("signup");
  if (!modal) return;

  var card = document.getElementById("signupCard");
  var form = document.getElementById("signupForm");
  var errorEl = document.getElementById("signupError");
  var successEl = document.getElementById("signupSuccess");
  var lastFocused = null;

  // GA4 helper — no-op if gtag is blocked/missing.
  function track(eventName) {
    if (typeof window.gtag === "function") window.gtag("event", eventName);
  }

  function open() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (form) form.hidden = false;
    if (successEl) successEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    var first = form && form.querySelector("input");
    if (first) setTimeout(function () { first.focus(); }, 50);
    document.addEventListener("keydown", onKey);
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKey(e) { if (e.key === "Escape") close(); }

  // Triggers
  document.querySelectorAll("[data-open-signup]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      track("begin_checkout");
      open();
    });
  });

  // Close controls
  modal.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", close);
  });

  // Submit → add contact to Brevo (list 7), then show success.
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ime = form.ime.value.trim();
    var email = form.email.value.trim();
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    form.ime.setAttribute("aria-invalid", ime ? "false" : "true");
    form.email.setAttribute("aria-invalid", emailOk ? "false" : "true");
    if (!ime || !emailOk) { errorEl.textContent = "Upiši ime i ispravan email."; errorEl.hidden = false; return; }
    errorEl.hidden = true;

    var submitBtn = document.getElementById("signupSubmit");
    if (submitBtn) submitBtn.disabled = true;

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ime: ime, email: email, listId: 7 })
    }).then(function (r) {
      if (!r.ok) throw new Error("request failed");
      form.hidden = true;                 // success only after a 2xx response
      if (successEl) successEl.hidden = false;
      track("generate_lead");
    }).catch(function () {
      errorEl.textContent = "Nešto nije u redu. Pokušaj ponovo.";
      errorEl.hidden = false;
    }).then(function () {
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  // 3D tilt on the card (desktop, fine pointer only)
  if (card && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      var rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
      var ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
      card.style.transform = "perspective(1200px) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
    });
    card.addEventListener("pointerleave", function () { card.style.transform = ""; });
  }
})();

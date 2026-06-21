/* ============================================================
   Signup / payment modal — streamlined flow:
   1) Ime, Telefon, Email
   2) Odakle plaćaš? (Srbija = list 3 / inostranstvo)
   3a) Inostranstvo: PayPal (Lavatop) / Western Union (8) / devizni (9)
   Each bank-style choice submits { ime, telefon, email, listId } to
   /api/subscribe and shows the "instrukcije stižu na email" result.
   The actual payment-instructions email is sent by a Brevo automation.
   "← Nazad" on every step (history stack). No storage.
   ============================================================ */
(function () {
  "use strict";

  var modal = document.getElementById("signup");
  if (!modal) return;

  var step1 = document.getElementById("signupStep1");
  var card = document.getElementById("signupCard");
  var errorEl = document.getElementById("signupError");
  var resultTitle = document.getElementById("signupResultTitle");
  var step1Subs = modal.querySelectorAll("[data-step1-only]");
  var step2Subs = modal.querySelectorAll("[data-step2-only]");
  var lastFocused = null;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // GA4 helper — no-op if gtag is blocked/missing.
  function track(eventName) {
    if (typeof window.gtag === "function") window.gtag("event", eventName);
  }

  var steps = {
    podaci: step1,
    odakle: document.getElementById("signupStepOdakle"),
    inostranstvo: document.getElementById("signupStepInostranstvo"),
    result: document.getElementById("signupStepResult")
  };
  var stack = [];

  function renderStep(name) {
    Object.keys(steps).forEach(function (k) {
      if (steps[k]) steps[k].hidden = (k !== name);
    });
    step1Subs.forEach(function (e) { e.hidden = name !== "podaci"; });
    step2Subs.forEach(function (e) { e.hidden = name === "podaci"; });
    var focusEl = steps[name] && steps[name].querySelector("input, button, a");
    if (focusEl) setTimeout(function () { focusEl.focus(); }, 50);
  }

  function goToStep(name) {
    if (!steps[name]) return;
    stack.push(name);
    renderStep(name);
  }

  function back() {
    if (stack.length > 1) {
      stack.pop();
      renderStep(stack[stack.length - 1]);
    }
  }

  function open() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    stack = ["podaci"];
    renderStep("podaci");
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

  // Step 1 (podaci) → validate ime + telefon + email → "Odakle plaćaš?"
  step1.addEventListener("submit", function (e) {
    e.preventDefault();
    var ime = step1.ime.value.trim();
    var tel = step1.telefon.value.trim();
    var email = step1.email.value.trim();
    var telOk = /[0-9]{6,}/.test(tel.replace(/[\s\-()+]/g, ""));
    var emailOk = EMAIL_RE.test(email);
    var ok = ime && telOk && emailOk;

    step1.ime.setAttribute("aria-invalid", ime ? "false" : "true");
    step1.telefon.setAttribute("aria-invalid", telOk ? "false" : "true");
    step1.email.setAttribute("aria-invalid", emailOk ? "false" : "true");

    if (!ok) { errorEl.hidden = false; return; }
    errorEl.hidden = true;
    goToStep("odakle");
  });

  // Step navigation (data-goto) + "← Nazad" (data-back).
  modal.querySelectorAll("[data-goto]").forEach(function (btn) {
    btn.addEventListener("click", function () { goToStep(btn.getAttribute("data-goto")); });
  });
  modal.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", back);
  });

  // PayPal → redirects to Lavatop checkout.
  modal.querySelectorAll("[data-paypal]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      track("begin_checkout");
      track("initiate_checkout");
    });
  });

  // Bank-style choices (data-submit) → add contact to Brevo (selected list),
  // then show the "instrukcije stižu na email" result.
  modal.querySelectorAll("[data-submit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var listId = parseInt(btn.getAttribute("data-list"), 10);
      var stepEl = btn.closest(".signup__step");
      var errEl = stepEl && stepEl.querySelector(".signup__error");
      if (errEl) errEl.hidden = true;

      var payload = {
        ime: step1.ime.value.trim(),
        telefon: step1.telefon.value.trim(),
        email: step1.email.value.trim(),
        listId: listId
      };

      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Šaljem…";
      track("begin_checkout");

      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error("request failed");
        if (resultTitle) resultTitle.textContent = btn.getAttribute("data-result-title") || "";
        goToStep("result");
        track("generate_lead");
      }).catch(function () {
        if (errEl) errEl.hidden = false;
      }).then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
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

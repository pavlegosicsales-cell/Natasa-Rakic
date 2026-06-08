/* ============================================================
   Signup modal — opens from the "Prijavi se" / price / finale CTAs.
   Step 1: ime, prezime, telefon. Step 2: izbor plaćanja
   (kartica → lava.top; preko računa → uskoro). No storage.
   ============================================================ */
(function () {
  "use strict";

  var modal = document.getElementById("signup");
  if (!modal) return;

  var step1 = document.getElementById("signupStep1");
  var card = document.getElementById("signupCard");
  var errorEl = document.getElementById("signupError");
  var bankNote = modal.querySelector(".signup__banknote");
  var bankForm = document.getElementById("signupBankForm");
  var bankError = document.getElementById("bankError");
  var step1Subs = modal.querySelectorAll("[data-step1-only]");
  var step2Subs = modal.querySelectorAll("[data-step2-only]");
  var lastFocused = null;

  // GA4 helper — no-op if gtag is missing (e.g. blocked by an ad blocker).
  function track(eventName) {
    if (typeof window.gtag === "function") window.gtag("event", eventName);
  }

  // Named steps + a small history stack so "← Nazad" returns to the previous step.
  // Flow: podaci → odakle → (email | inostranstvo → email). The email step is
  // shared by all paths that submit to /api/subscribe (Brevo list 3).
  var steps = {
    podaci: step1,
    odakle: document.getElementById("signupStepOdakle"),
    inostranstvo: document.getElementById("signupStepInostranstvo"),
    email: document.getElementById("signupStepEmail")
  };
  var stack = [];

  function renderStep(name) {
    Object.keys(steps).forEach(function (k) {
      if (steps[k]) steps[k].hidden = (k !== name);
    });
    // Head subtitle: only the data-collection step uses the step-1 copy.
    step1Subs.forEach(function (e) { e.hidden = name !== "podaci"; });
    step2Subs.forEach(function (e) { e.hidden = name === "podaci"; });
    // Reset the (shared) email step each time it is shown.
    if (name === "email") {
      if (bankForm) bankForm.hidden = false;
      if (bankNote) bankNote.hidden = true;
      if (bankError) bankError.hidden = true;
    }
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
      track("begin_checkout"); // "Prijavi se" CTA
      open();
    });
  });

  // PayPal button → redirects to Lavatop checkout.
  modal.querySelectorAll("[data-paypal]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      track("begin_checkout");
      track("initiate_checkout"); // PayPal → Lavatop redirect
    });
  });

  // Close controls
  modal.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", close);
  });

  // Step 1 → validate → Step 2
  step1.addEventListener("submit", function (e) {
    e.preventDefault();
    var ime = step1.ime.value.trim();
    var prezime = step1.prezime.value.trim();
    var tel = step1.telefon.value.trim();
    var telOk = /[0-9]{6,}/.test(tel.replace(/[\s\-()+]/g, ""));
    var ok = ime && prezime && telOk;

    [step1.ime, step1.prezime].forEach(function (f) {
      f.setAttribute("aria-invalid", f.value.trim() ? "false" : "true");
    });
    step1.telefon.setAttribute("aria-invalid", telOk ? "false" : "true");

    if (!ok) { errorEl.hidden = false; return; }
    errorEl.hidden = true;
    goToStep("odakle");
  });

  // Step navigation: "Plaćam iz Srbije"/"...inostranstva", WU, račun (data-goto)
  // and "← Nazad" (data-back) on every step.
  var emailTitle = document.getElementById("signupEmailTitle");
  modal.querySelectorAll("[data-goto]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      // The email step is shared; set its title from the button that opened it
      // so it's clear which method (račun, Western Union…) the user picked.
      var t = btn.getAttribute("data-email-title");
      if (t && emailTitle) emailTitle.textContent = t;
      goToStep(btn.getAttribute("data-goto"));
    });
  });
  modal.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", back);
  });

  // Bank email form submit → add contact to Brevo, then show success
  if (bankForm) bankForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = bankForm.bankEmail.value.trim();
    track("begin_checkout"); // "Pošalji mi instrukcije" CTA
    var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    bankForm.bankEmail.setAttribute("aria-invalid", valid ? "false" : "true");
    if (!valid) { bankError.textContent = "Unesi ispravnu email adresu."; bankError.hidden = false; return; }
    bankError.hidden = true;

    // Reuse the data already entered in step 1 (no new fields).
    var payload = {
      ime: step1.ime.value.trim(),
      prezime: step1.prezime.value.trim(),
      telefon: step1.telefon.value.trim(),
      email: email
    };

    var submitBtn = bankForm.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error("request failed");
      bankForm.hidden = true;                 // success only after a 2xx response
      if (bankNote) bankNote.hidden = false;
      track("generate_lead");                 // email captured → success shown
    }).catch(function () {
      bankError.textContent = "Nešto nije u redu. Pokušaj ponovo.";
      bankError.hidden = false;
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

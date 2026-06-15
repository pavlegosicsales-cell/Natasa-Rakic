/* ============================================================
   Signup / payment modal — 3-step flow:
   1) Ime, Prezime, Telefon
   2) Odakle plaćaš? (Srbija / inostranstvo)
   3) Plaćanje: Srbija → email (list 3); inostranstvo → PayPal (Lavatop) /
      Western Union (list 8) / devizni račun (list 9), each via the shared
      email step → POST { ime, prezime, telefon, email, listId } to /api/subscribe.
   "← Nazad" on every step (history stack). No storage.
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
  var emailTitle = document.getElementById("signupEmailTitle");
  var step1Subs = modal.querySelectorAll("[data-step1-only]");
  var step2Subs = modal.querySelectorAll("[data-step2-only]");
  var lastFocused = null;
  var selectedListId = 3; // Brevo list for the chosen payment method (3 = Srbija/default)

  // GA4 helper — no-op if gtag is blocked/missing.
  function track(eventName) {
    if (typeof window.gtag === "function") window.gtag("event", eventName);
  }

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
    step1Subs.forEach(function (e) { e.hidden = name !== "podaci"; });
    step2Subs.forEach(function (e) { e.hidden = name === "podaci"; });
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
      track("begin_checkout");
      open();
    });
  });

  // Close controls
  modal.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", close);
  });

  // Step 1 (podaci) → validate → "Odakle plaćaš?"
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

  // Step navigation (data-goto) + "← Nazad" (data-back) on every step.
  modal.querySelectorAll("[data-goto]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var t = btn.getAttribute("data-email-title");
      if (t && emailTitle) emailTitle.textContent = t;
      var list = btn.getAttribute("data-list");
      if (list) selectedListId = parseInt(list, 10);
      goToStep(btn.getAttribute("data-goto"));
    });
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

  // Email form submit → add contact to Brevo (selected list), then show success.
  if (bankForm) bankForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = bankForm.bankEmail.value.trim();
    track("begin_checkout");
    var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    bankForm.bankEmail.setAttribute("aria-invalid", valid ? "false" : "true");
    if (!valid) { bankError.textContent = "Unesi ispravnu email adresu."; bankError.hidden = false; return; }
    bankError.hidden = true;

    var payload = {
      ime: step1.ime.value.trim(),
      prezime: step1.prezime.value.trim(),
      telefon: step1.telefon.value.trim(),
      email: email,
      listId: selectedListId
    };

    var submitBtn = bankForm.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error("request failed");
      bankForm.hidden = true;
      if (bankNote) bankNote.hidden = false;
      track("generate_lead");
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

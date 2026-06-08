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
  var step2 = document.getElementById("signupStep2");
  var card = document.getElementById("signupCard");
  var errorEl = document.getElementById("signupError");
  var bankNote = modal.querySelector(".signup__banknote");
  var bankForm = document.getElementById("signupBankForm");
  var bankError = document.getElementById("bankError");
  var step1Subs = modal.querySelectorAll("[data-step1-only]");
  var step2Subs = modal.querySelectorAll("[data-step2-only]");
  var lastFocused = null;

  function showStep(n) {
    step1.hidden = n !== 1;
    step2.hidden = n !== 2;
    step1Subs.forEach(function (e) { e.hidden = n !== 1; });
    step2Subs.forEach(function (e) { e.hidden = n !== 2; });
    if (bankNote) bankNote.hidden = true;
    if (bankForm) { bankForm.hidden = true; if (bankError) bankError.hidden = true; }
  }

  function open() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    showStep(1);
    var first = step1.querySelector("input");
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
      open();
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
    showStep(2);
  });

  // Back to step 1
  var backBtn = modal.querySelector("[data-back]");
  if (backBtn) backBtn.addEventListener("click", function () { showStep(1); });

  // "Plaćanje preko računa" and "Strano plaćanje" → reveal the SAME email form.
  modal.querySelectorAll("[data-bank]").forEach(function (bankBtn) {
    bankBtn.addEventListener("click", function () {
      if (bankNote) bankNote.hidden = true;
      if (bankForm) {
        bankForm.hidden = false;
        var input = bankForm.querySelector("input");
        if (input) setTimeout(function () { input.focus(); }, 50);
      }
    });
  });

  // Bank email form submit → add contact to Brevo, then show success
  if (bankForm) bankForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = bankForm.bankEmail.value.trim();
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

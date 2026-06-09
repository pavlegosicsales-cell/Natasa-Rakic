/* ============================================================
   Vercel serverless function — adds a signup contact to Brevo.

   The actual "uputstvo za uplatu" email is NOT sent from here:
   it is sent by a Brevo Automation ("on contact added to list →
   send email"). This function only needs to add the contact to
   the right list with the right attributes; Brevo does the rest.

   Set BREVO_API_KEY in Vercel → Settings → Environment Variables.
   ============================================================ */

// Brevo lists:
//   7 — free signup (default, current flow)
//   3/8/9 — legacy payment lists (Srbija / WU-Ria-MG / devizni račun)
const BREVO_DEFAULT_LIST_ID = 7;
var BREVO_ALLOWED_LISTS = [3, 7, 8, 9]; // allowlist — never trust a client-supplied list id blindly
var BREVO_PAYMENT_LISTS = [3, 8, 9];    // legacy payment lists (mutually exclusive via unlink)

function resolveListId(raw) {
  var n = typeof raw === "number" ? raw : parseInt(raw, 10);
  return BREVO_ALLOWED_LISTS.indexOf(n) !== -1 ? n : BREVO_DEFAULT_LIST_ID;
}

/* Brevo's SMS attribute is validated as an E.164 phone number. A local
   Serbian format ("062 123 4567") is rejected as "Invalid phone number",
   which is why signup worked for some users (who typed +381…) but not
   others. Normalize to international format before sending. */
function normalizePhone(raw) {
  if (!raw) return "";
  var s = String(raw).replace(/[^\d+]/g, ""); // keep digits and a leading +
  s = s.replace(/(?!^)\+/g, "");              // a "+" is only valid at the very start
  if (s.charAt(0) === "+") return s;          // already international
  if (s.slice(0, 2) === "00") return "+" + s.slice(2); // 00381… → +381…
  if (s.slice(0, 3) === "381") return "+" + s;         // 381…   → +381…
  if (s.charAt(0) === "0") return "+381" + s.slice(1); // 06X…   → +3816X…
  if (s.length >= 6) return "+381" + s;                // bare local (6X…) → assume RS
  return "";
}

function createContact(apiKey, email, attributes, listId) {
  return fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      email: email,
      listIds: [listId],
      updateEnabled: true,
      attributes: attributes
    })
  });
}

// 2xx (incl. 201 created / 204 updated) OR an existing contact = success.
function isSuccess(status, data) {
  if (status >= 200 && status < 300) return true;
  return !!(data && data.code === "duplicate_parameter");
}

/* Each contact must end up on exactly ONE payment list — otherwise (because
   updateEnabled:true only ADDS to a list, never removes) a returning buyer
   accumulates on several lists, multiple Brevo automations fire, and they get
   the WRONG payment-instructions email. After adding to the chosen list, remove
   the contact from the other payment lists. Best-effort: never fails the signup. */
async function unlinkOtherPaymentLists(apiKey, email, keepListId) {
  // Only relevant for the legacy payment lists; the free list (7) is left alone.
  if (BREVO_PAYMENT_LISTS.indexOf(keepListId) === -1) return;
  var others = BREVO_PAYMENT_LISTS.filter(function (id) { return id !== keepListId; });
  if (!others.length) return;
  try {
    var r = await fetch("https://api.brevo.com/v3/contacts/" + encodeURIComponent(email), {
      method: "PUT",
      headers: { "accept": "application/json", "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ unlinkListIds: others })
    });
    if (!(r.status >= 200 && r.status < 300)) {
      var b = await r.text().catch(function () { return ""; });
      console.error("[subscribe] unlink other lists failed — status:", r.status, "body:", b);
    }
  } catch (e) {
    console.error("[subscribe] unlink error:", e && e.message ? e.message : e);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Vercel usually parses JSON into req.body; fall back to manual parse just in case.
    var body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    var ime = typeof body.ime === "string" ? body.ime.trim() : "";
    var prezime = typeof body.prezime === "string" ? body.prezime.trim() : "";
    var telefon = typeof body.telefon === "string" ? body.telefon.trim() : "";
    var email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Server-side validation — free signup needs only ime + email
    // (prezime/telefon remain optional for any legacy callers).
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk || !ime) {
      return res.status(400).json({ error: "Nedostaju podaci ili neispravan email." });
    }

    var apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error("[subscribe] Missing BREVO_API_KEY env var.");
      return res.status(500).json({ error: "Server nije konfigurisan." });
    }

    var phone = normalizePhone(telefon);

    // Which Brevo list (payment method) — validated against the allowlist.
    var listId = resolveListId(body.listId);

    // Attempt 1: include the SMS attribute (normalized phone).
    var attrs = { IME: ime, PREZIME: prezime };
    if (phone) attrs.SMS = phone;

    var resp = await createContact(apiKey, email, attrs, listId);
    var rawBody = await resp.text().catch(function () { return ""; });
    var data = {};
    try { data = JSON.parse(rawBody); } catch (_) { data = {}; }

    if (isSuccess(resp.status, data)) {
      await unlinkOtherPaymentLists(apiKey, email, listId);
      return res.status(200).json({ ok: true });
    }

    // Log the full Brevo error (status + body). Brevo's body never contains
    // the API key, so this is safe to log. Visible in Vercel function logs.
    console.error(
      "[subscribe] Brevo error (attempt 1) — status:", resp.status,
      "statusText:", resp.statusText, "body:", rawBody
    );

    // If Brevo rejected the phone number, retry WITHOUT the SMS attribute so the
    // signup still succeeds (the contact is added → automation email fires).
    var phoneRejected = phone && data && data.code === "invalid_parameter";
    if (phoneRejected) {
      var resp2 = await createContact(apiKey, email, { IME: ime, PREZIME: prezime }, listId);
      var rawBody2 = await resp2.text().catch(function () { return ""; });
      var data2 = {};
      try { data2 = JSON.parse(rawBody2); } catch (_) { data2 = {}; }

      if (isSuccess(resp2.status, data2)) {
        console.error("[subscribe] Recovered without SMS attribute for:", email);
        await unlinkOtherPaymentLists(apiKey, email, listId);
        return res.status(200).json({ ok: true });
      }
      console.error(
        "[subscribe] Brevo error (attempt 2, no SMS) — status:", resp2.status,
        "statusText:", resp2.statusText, "body:", rawBody2
      );
    }

    // Do NOT leak the API key or raw Brevo response details to the client.
    return res.status(502).json({ error: "Neuspešno dodavanje kontakta." });
  } catch (e) {
    console.error("[subscribe] Unexpected server error:", e && e.stack ? e.stack : e);
    return res.status(500).json({ error: "Greška na serveru." });
  }
};

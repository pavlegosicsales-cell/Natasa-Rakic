/* ============================================================
   Vercel serverless function — Lavatop purchase webhook.

   Lavatop calls this endpoint (POST) when a card purchase is
   completed. We verify the request with HTTP Basic auth, then
   add the buyer as a contact to a dedicated Brevo list so the
   "kartica" automation (email with access/instructions) can fire.

   Required environment variables (Vercel → Settings → Env Vars):
     - LAVATOP_WEBHOOK_LOGIN     (Basic auth username, set in Lavatop)
     - LAVATOP_WEBHOOK_PASSWORD  (Basic auth password, set in Lavatop)
     - LAVATOP_WEBHOOK_SECRET    (Lavatop API key — stored for future use,
                                  e.g. verifying a signed payload / calling
                                  Lavatop back; not used to authorize yet)
     - BREVO_API_KEY             (already configured for /api/subscribe)

   TODO (Brevo dashboard, one-time): create a new list named
   "Izazov — kartica" and confirm its list ID is 6. If Brevo assigns
   a different ID, update BREVO_KARTICA_LIST_ID below.

   TODO (Lavatop dashboard, one-time): register this URL as the
   purchase/success webhook and set the Basic auth login + password
   to match the env vars above.
   ============================================================ */

const crypto = require("crypto");

// TODO: confirm this matches the real "Izazov — kartica" list ID in Brevo.
const BREVO_KARTICA_LIST_ID = 6;

// Constant-time string compare to avoid leaking credentials via timing.
function safeEqual(a, b) {
  var ab = Buffer.from(String(a == null ? "" : a));
  var bb = Buffer.from(String(b == null ? "" : b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Verify the incoming request carries the expected Basic auth credentials.
function isAuthorized(req) {
  var expectedUser = process.env.LAVATOP_WEBHOOK_LOGIN;
  var expectedPass = process.env.LAVATOP_WEBHOOK_PASSWORD;
  if (!expectedUser || !expectedPass) {
    console.error("[lavatop-webhook] Missing LAVATOP_WEBHOOK_LOGIN/PASSWORD env vars.");
    return false;
  }

  var header = req.headers["authorization"] || req.headers["Authorization"] || "";
  if (typeof header !== "string" || header.indexOf("Basic ") !== 0) return false;

  var decoded = "";
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch (_) {
    return false;
  }

  var idx = decoded.indexOf(":");
  if (idx === -1) return false;
  var user = decoded.slice(0, idx);
  var pass = decoded.slice(idx + 1);

  // Evaluate both halves before returning so the work is independent of which fails.
  var userOk = safeEqual(user, expectedUser);
  var passOk = safeEqual(pass, expectedPass);
  return userOk && passOk;
}

// Pick the first present, non-empty value among several possible field names.
function firstField(obj, names) {
  for (var i = 0; i < names.length; i++) {
    var v = obj[names[i]];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1) Authenticate the webhook BEFORE doing any work.
  if (!isAuthorized(req)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="lavatop-webhook"');
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Vercel usually parses JSON into req.body; fall back to manual parse just in case.
    var body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    // Lavatop may send the buyer email under any of these keys — use the first present.
    var email = firstField(body, ["buyer_email", "email", "customer_email"]).toLowerCase();
    var name = firstField(body, ["name", "buyer_name", "clientName", "fullName", "firstName"]);
    var amount = firstField(body, ["amount", "sum", "price", "total"]);

    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      console.error("[lavatop-webhook] Missing/invalid email in payload:", JSON.stringify(body));
      // 400 so Lavatop can surface a bad payload; auth already passed.
      return res.status(400).json({ error: "Invalid or missing email." });
    }

    var apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error("[lavatop-webhook] Missing BREVO_API_KEY env var.");
      return res.status(500).json({ error: "Server not configured." });
    }

    // Lavatop API key — read and reserved for future use (e.g. verifying a
    // signed payload or calling the Lavatop API back). Not used yet.
    // TODO: use this when adding payload-signature verification.
    var lavatopSecret = process.env.LAVATOP_WEBHOOK_SECRET; // eslint-disable-line no-unused-vars

    // TODO: Lavatop sends a single "name". We store it in IME for now.
    // If you want IME/PREZIME split, split on the first space here — and make
    // sure both attributes exist in Brevo.
    // TODO: to also store the purchase amount, create a custom attribute
    // (e.g. IZNOS) in Brevo and add it to `attributes` below — sending an
    // attribute that does not exist in Brevo causes the request to fail.
    var attributes = {};
    if (name) attributes.IME = name;

    var resp = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        email: email,
        listIds: [BREVO_KARTICA_LIST_ID],
        updateEnabled: true,
        attributes: attributes
      })
    });

    var rawBody = await resp.text().catch(function () { return ""; });
    var data = {};
    try { data = JSON.parse(rawBody); } catch (_) { data = {}; }

    // 2xx, or an already-existing contact (updateEnabled) → success.
    if ((resp.status >= 200 && resp.status < 300) || (data && data.code === "duplicate_parameter")) {
      console.log("[lavatop-webhook] Contact added to list", BREVO_KARTICA_LIST_ID, "—", email, "amount:", amount || "n/a");
      return res.status(200).json({ ok: true });
    }

    // Brevo's error body never contains the API key, so this is safe to log.
    console.error(
      "[lavatop-webhook] Brevo API error — status:", resp.status,
      "statusText:", resp.statusText, "body:", rawBody
    );
    return res.status(500).json({ error: "Failed to add contact." });
  } catch (e) {
    console.error("[lavatop-webhook] Unexpected server error:", e && e.stack ? e.stack : e);
    return res.status(500).json({ error: "Server error." });
  }
};

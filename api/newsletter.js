/* ============================================================
   Vercel serverless function — newsletter / lead-magnet signup.

   The bottom-of-page form captures only an email (lead magnet:
   the free video). We add that email to a dedicated Brevo list
   so the lead-magnet automation can deliver it. This is kept
   separate from /api/subscribe (which needs ime/prezime/telefon
   and uses list 3) so the email-only flow never collides with it.

   Set BREVO_API_KEY in Vercel → Settings → Environment Variables.
   ============================================================ */

const BREVO_NEWSLETTER_LIST_ID = 7; // "Newsletter — lead magnet"

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

    var email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Basic server-side email validation — never trust the client.
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ error: "Neispravan email." });
    }

    var apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error("[newsletter] Missing BREVO_API_KEY env var.");
      return res.status(500).json({ error: "Server nije konfigurisan." });
    }

    var resp = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        email: email,
        listIds: [BREVO_NEWSLETTER_LIST_ID],
        updateEnabled: true
      })
    });

    var rawBody = await resp.text().catch(function () { return ""; });
    var data = {};
    try { data = JSON.parse(rawBody); } catch (_) { data = {}; }

    // 2xx, or an already-existing contact (updateEnabled) → success.
    if ((resp.status >= 200 && resp.status < 300) || (data && data.code === "duplicate_parameter")) {
      return res.status(200).json({ ok: true });
    }

    // Brevo's error body never contains the API key, so this is safe to log.
    console.error(
      "[newsletter] Brevo API error — status:", resp.status,
      "statusText:", resp.statusText, "body:", rawBody
    );
    return res.status(502).json({ error: "Neuspešno dodavanje kontakta." });
  } catch (e) {
    console.error("[newsletter] Unexpected server error:", e && e.stack ? e.stack : e);
    return res.status(500).json({ error: "Greška na serveru." });
  }
};

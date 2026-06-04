/* ============================================================
   Vercel serverless function — adds a signup contact to Brevo.

   The actual "uputstvo za uplatu" email is NOT sent from here:
   it is sent by a Brevo Automation ("on contact added to list →
   send email"). This function only needs to add the contact to
   the right list with the right attributes; Brevo does the rest.

   Set BREVO_API_KEY in Vercel → Settings → Environment Variables.
   ============================================================ */

const BREVO_LIST_ID = 3; // Brevo list ID

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
    var email = typeof body.email === "string" ? body.email.trim() : "";

    // Server-side validation — never trust the client.
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk || !ime || !prezime || !telefon) {
      return res.status(400).json({ error: "Nedostaju podaci ili neispravan email." });
    }

    var apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
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
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
        attributes: { IME: ime, PREZIME: prezime, SMS: telefon }
      })
    });

    // 201 created, 204 updated → success
    if (resp.ok || resp.status === 204) {
      return res.status(200).json({ ok: true });
    }

    // Existing contact (with updateEnabled this is usually fine) → treat as success
    var data = await resp.json().catch(function () { return {}; });
    if (data && data.code === "duplicate_parameter") {
      return res.status(200).json({ ok: true });
    }

    // Do NOT leak the API key or raw Brevo response details to the client.
    return res.status(502).json({ error: "Neuspešno dodavanje kontakta." });
  } catch (e) {
    return res.status(500).json({ error: "Greška na serveru." });
  }
};

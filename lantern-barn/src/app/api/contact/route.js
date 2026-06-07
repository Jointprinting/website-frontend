import { NextResponse } from "next/server";

// Contact / inquiry form handler.
//
// If RESEND_API_KEY is set, it emails the submission to CONTACT_TO_EMAIL via
// Resend (https://resend.com — free tier, no SDK needed). Otherwise it logs the
// message and still returns success, so the form works during development.
export async function POST(request) {
  let data;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { name, email, topic, message } = data || {};
  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Please fill in name, email and message." },
      { status: 400 }
    );
  }

  const to = process.env.CONTACT_TO_EMAIL || "hello@lanternbarn.com";
  const apiKey = process.env.RESEND_API_KEY;

  const subject = `Lantern Barn inquiry${topic ? ` — ${topic}` : ""} from ${name}`;
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    topic ? `Topic: ${topic}` : null,
    "",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  if (!apiKey) {
    console.log("[contact] (no RESEND_API_KEY set) would email:", { to, subject, body });
    return NextResponse.json({ ok: true });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Lantern Barn <onboarding@resend.dev>",
        to: [to],
        reply_to: email,
        subject,
        text: body,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] send failed:", err.message);
    return NextResponse.json({ error: "Could not send message." }, { status: 502 });
  }
}

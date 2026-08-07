import { NextResponse } from "next/server";

// Newsletter signups — the heart of the "community" engine.
//
// For now this logs the email and returns success so the form works out of the
// box. To actually collect addresses, connect one of these (see README):
//   • Mailchimp / Buttondown / ConvertKit  — paste their API call below, or
//   • Resend Audiences                      — store contacts, or
//   • A simple Google Sheet via webhook.
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // TODO: forward `email` to your email provider here.
    console.log("[newsletter] new signup:", email);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

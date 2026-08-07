"use client";

import { useState } from "react";

export default function NewsletterSignup({ variant = "section" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error

  async function onSubmit(e) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  const footer = variant === "footer";

  if (status === "done") {
    return (
      <p className={footer ? "text-sm text-lantern" : "text-base text-pine"}>
        You're on the list — see you at the barn. 🥔
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      {!footer && (
        <label htmlFor={`nl-${variant}`} className="eyebrow mb-2 block">
          Join the community
        </label>
      )}
      <div className={`flex gap-2 ${footer ? "flex-col sm:flex-row" : "flex-col sm:flex-row"}`}>
        <input
          id={`nl-${variant}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className={`w-full rounded-full px-4 py-3 text-sm outline-none ${
            footer
              ? "bg-cream/10 text-cream placeholder:text-cream/50 focus:bg-cream/15"
              : "border border-pine/20 bg-white text-ink placeholder:text-ink/40"
          }`}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-accent shrink-0 disabled:opacity-60"
        >
          {status === "loading" ? "Joining…" : "Sign up"}
        </button>
      </div>
      <p className={`mt-2 text-xs ${footer ? "text-cream/55" : "text-ink/50"}`}>
        {status === "error"
          ? "Something went wrong — try again in a moment."
          : "Event invites & barn news. No spam, unsubscribe anytime."}
      </p>
    </form>
  );
}

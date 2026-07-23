"use client";

import { useState } from "react";

const topics = ["General", "Event", "Order", "Private hire", "Press"];

export default function ContactForm({ defaultTopic = "General" }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const form = e.currentTarget;
    const payload = {
      name: form.name.value,
      email: form.email.value,
      topic: form.topic.value,
      message: form.message.value,
    };
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send message.");
      }
      setStatus("done");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl2 bg-white p-8 text-center shadow-soft">
        <p className="text-2xl text-pine">Thanks — we got it. 🥔</p>
        <p className="mt-2 text-ink/70">
          We'll be in touch soon. In the meantime, come say hi at the barn.
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-pine/20 bg-white px-4 py-3 text-sm outline-none focus:border-pine";

  return (
    <form onSubmit={onSubmit} className="rounded-xl2 bg-white p-6 shadow-soft sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink/80">Name</label>
          <input id="name" name="name" required className={field} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink/80">Email</label>
          <input id="email" name="email" type="email" required className={field} />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="topic" className="mb-1 block text-sm font-medium text-ink/80">What's this about?</label>
        <select id="topic" name="topic" defaultValue={defaultTopic} className={field}>
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-ink/80">Message</label>
        <textarea id="message" name="message" rows={5} required className={field} />
      </div>

      {status === "error" && (
        <p className="mt-3 text-sm text-clay">{error}</p>
      )}

      <button type="submit" disabled={status === "loading"} className="btn-accent mt-5 w-full disabled:opacity-60">
        {status === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

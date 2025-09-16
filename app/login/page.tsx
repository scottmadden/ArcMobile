// app/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    setMsg(error ? `Error: ${error.message}` : "Signed in! Redirecting…");
    if (!error) window.location.href = "/assignments";
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}` },
    });
    setLoading(false);
    setMsg(error ? `Error: ${error.message}` : "Check your email for the sign-in link.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMsg("Signed out.");
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">Sign in</h1>

      <form onSubmit={signInWithPassword} className="space-y-3 bg-white p-4 rounded-2xl shadow-sm">
        <input
          className="w-full border rounded-xl p-3"
          type="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded-xl p-3"
          type="password" placeholder="Password"
          value={pw} onChange={(e) => setPw(e.target.value)}
        />
        <button className="w-full rounded-2xl bg-[#004C97] text-white py-3 disabled:opacity-50" disabled={loading}>
          {loading ? "Signing in…" : "Sign in with password"}
        </button>
      </form>

      <form onSubmit={sendMagicLink} className="space-y-3 bg-white p-4 rounded-2xl shadow-sm">
        <div className="text-sm font-medium">Or use a magic link</div>
        <input
          className="w-full border rounded-xl p-3"
          type="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <button className="w-full rounded-2xl border py-3" disabled={loading}>
          {loading ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      <button onClick={signOut} className="w-full text-sm underline">Sign out</button>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}
    </main>
  );
}

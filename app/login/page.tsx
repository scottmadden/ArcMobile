"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase"; // keep relative path

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMsg(error.message);
    else window.location.href = "/checklist";
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMsg("Signed out.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-sm">
        <h1 className="text-xl font-bold text-[#004C97]">Sign in</h1>
        <form onSubmit={handleSignIn} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="demo1234"
              required
            />
          </div>
          <button className="w-full rounded-xl bg-[#004C97] text-white py-2" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <button className="w-full rounded-xl border py-2" type="button" onClick={handleSignOut}>
            Sign Out
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-[#6B7280]">{msg}</p>}
        <p className="mt-4 text-sm">
          After sign-in you’ll be redirected to <a className="underline" href="/checklist">/checklist</a>.
        </p>
      </div>
    </main>
  );
}

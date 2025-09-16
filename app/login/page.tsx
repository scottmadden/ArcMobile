// app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const params = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [notice, setNotice] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [log, setLog] = useState<string[]>([]); // optional debug panel like other pages

  const next = params.get("next") || "/assignments"; // change to "/dashboard" later

  // If already logged in, bounce to next
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setNotice("");
    setLog([]);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLog((l) => [...l, `sign-in error: ${error.message}`]);
      setLoading(false);
      return;
    }

    if (data?.user) {
      router.replace(next);
    } else {
      setNotice("Signed in.");
      router.replace(next);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setNotice("");
    setLog([]);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLog((l) => [...l, `sign-up error: ${error.message}`]);
      setLoading(false);
      return;
    }

    // Depending on your Supabase email confirmation settings, a session may or may not exist here.
    if (data.session) {
      router.replace(next);
    } else {
      setNotice("Check your email to confirm your account, then return here to sign in.");
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <p className="text-sm text-[#6B7280]">
        {mode === "signin"
          ? "Enter your email and password to continue."
          : "Create your ArcMobile account."}
      </p>

      {(notice || errorMsg || log.length > 0) && (
        <div
          className={`p-3 rounded-2xl ${
            errorMsg || log.length
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {notice && <div>{notice}</div>}
          {errorMsg && <div className="font-medium">{errorMsg}</div>}
          {log.length > 0 && (
            <>
              <div className="font-semibold mt-2 mb-1">Debug</div>
              <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <form
        onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
        className="space-y-4 bg-white rounded-2xl shadow-sm p-4"
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border p-3"
            placeholder="you@company.com"
            autoComplete="email"
            inputMode="email"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border p-3"
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[#004C97] text-white py-3 disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="text-center text-sm">
        {mode === "signin" ? (
          <>
            Don’t have an account?{" "}
            <button
              className="underline"
              onClick={() => {
                setMode("signup");
                setErrorMsg("");
                setNotice("");
              }}
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              className="underline"
              onClick={() => {
                setMode("signin");
                setErrorMsg("");
                setNotice("");
              }}
            >
              Sign in
            </button>
          </>
        )}
      </div>

      <div className="text-xs text-[#6B7280] text-center">
        You’ll be redirected to <span className="font-mono">{next}</span> after authentication.
      </div>
    </main>
  );
}

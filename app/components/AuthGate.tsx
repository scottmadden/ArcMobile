// app/components/AuthGate.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Props = { children: React.ReactNode };

export default function AuthGate({ children }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();

  // Redirect to /login when there is no session (except on public routes)
  useEffect(() => {
    (async () => {
      // Allow the login route (and anything under it) without a session
      if (pathname?.startsWith("/login")) return;

      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        const search = params?.toString();
        const nextUrl = pathname + (search ? `?${search}` : "");
        window.location.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
      }
    })();
  }, [pathname, params]);

  // Also handle sign-outs while the app is open
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session && !pathname?.startsWith("/login")) {
        const search = params?.toString();
        const nextUrl = pathname + (search ? `?${search}` : "");
        window.location.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
      }
    });
    return () => sub.data.subscription.unsubscribe();
  }, [pathname, params]);

  return <>{children}</>;
}

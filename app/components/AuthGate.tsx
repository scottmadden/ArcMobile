// app/components/AuthGate.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const PUBLIC_ROUTES = new Set([
  "/login",
  "/auth/callback", // if you use it
]);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function run() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      // If not logged in and not already on a public route, go to /login
      if (!user && !PUBLIC_ROUTES.has(pathname)) {
        const next = pathname + (search?.toString() ? `?${search}` : "");
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // If logged in and sitting on /login, send them to next (or a default)
      if (user && pathname === "/login") {
        const next = search?.get("next") || "/assignments"; // change to /dashboard later
        router.replace(next);
      }
    }

    // react to auth changes too
    const { data: sub } = supabase.auth.onAuthStateChange(() => run());
    run();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return <>{children}</>;
}

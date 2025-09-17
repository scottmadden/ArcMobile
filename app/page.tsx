"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      router.replace(user ? "/dashboard" : "/login");
    })();
  }, [router]);

  return <main className="p-6">Loading…</main>;
}

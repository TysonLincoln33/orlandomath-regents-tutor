"use client";

import { useEffect, useState } from "react";

import { canUsePrintControls } from "@/lib/auth/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useCanUsePrintControls() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadPrintAccess() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          if (active) setAllowed(false);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const profile = data as { role: string | null } | null;

        if (active) setAllowed(canUsePrintControls(profile?.role));
      } catch (err) {
        console.warn("Failed to verify print access:", err);
        if (active) setAllowed(false);
      }
    }

    loadPrintAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadPrintAccess();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return allowed;
}

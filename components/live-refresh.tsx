"use client";
import { newId } from "@/lib/id";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/supabase/config";
import { millisecondsUntilMidnight } from "@/lib/time";

// Realtime refreshes open pages after edits. A 30s fallback handles dropped sockets.
// Midnight gets its own timer; returning to a sleeping phone also refreshes data.
export function LiveRefresh({ timezone }: { timezone: string }) {
  const router = useRouter();
  useEffect(() => {
    let midnight: ReturnType<typeof setTimeout>;
    const refresh = () => router.refresh();
    function scheduleMidnight() {
      midnight = setTimeout(
        () => {
          refresh();
          scheduleMidnight();
        },
        millisecondsUntilMidnight(timezone) + 50,
      );
    }
    scheduleMidnight();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", refresh);
    const db = isConfigured() ? createClient() : null;
    const channel = db?.channel(`shop-${newId()}`);
    if (channel) {
      for (const table of ["shop_settings", "weekly_hours"])
        channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
      channel.subscribe();
    }
    return () => {
      clearTimeout(midnight);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", refresh);
      if (channel) void db?.removeChannel(channel);
    };
  }, [router, timezone]);
  return null;
}

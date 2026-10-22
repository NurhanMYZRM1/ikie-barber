import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";

// Repeat authorization inside every read/action: middleware alone is not security.
export async function requireOwner() {
  if (!isConfigured()) redirect("/admin/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data, error } = await supabase.rpc("is_shop_owner");
  if (error || data !== true) redirect("/admin/login");
  return supabase;
}

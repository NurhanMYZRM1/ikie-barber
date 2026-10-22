"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";

// The owner types a short ID instead of an email. The ID maps to the owner's Supabase
// account through server-only env vars; the password itself lives only in Supabase Auth
// (hashed and rate-limited), never in this code or in env.
const WRONG = "That ID or password isn’t right.";

export async function login(_previous: { error: string }, form: FormData) {
  const ownerId = process.env.OWNER_USERNAME?.trim().toLowerCase();
  const email = process.env.OWNER_EMAIL;
  if (!isConfigured() || !ownerId || !email)
    return { error: "Owner login isn’t set up yet. Follow README.md to finish setup." };
  const parsed = z
    .object({ id: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your ID and password." };
  // Same message for a wrong ID or password, so neither can be confirmed separately.
  if (parsed.data.id.toLowerCase() !== ownerId) return { error: WRONG };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (error) return { error: WRONG };
  const { data: owner } = await supabase.rpc("is_shop_owner");
  if (!owner) {
    await supabase.auth.signOut();
    return { error: "This account isn’t the shop owner. Check the owner setup in the README." };
  }
  redirect("/admin");
}

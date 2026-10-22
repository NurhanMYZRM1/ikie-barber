import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, getSupabaseConfig } from "@/lib/supabase/config";

// Next.js 15 uses middleware.ts. Verify the session with Auth, not getSession().
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const login = request.nextUrl.pathname === "/admin/login";
  function toLogin() {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  if (!isConfigured()) return login ? response : toLogin();
  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!login) {
    if (!user) return toLogin();
    const { data: owner, error } = await supabase.rpc("is_shop_owner");
    if (error || !owner) return toLogin();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/admin/:path*"] };

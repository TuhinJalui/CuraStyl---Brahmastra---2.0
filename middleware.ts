import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that require authentication
const PROTECTED_ROUTES = ["/checkout", "/salon-owner/dashboard", "/admin"];
// Routes that require salon_owner role
const OWNER_ROUTES = ["/salon-owner/dashboard"];
// Routes that require admin role
const ADMIN_ROUTES = ["/admin"];
// Auth routes — logged-in users should be redirected away
const AUTH_ROUTES = ["/auth/login", "/auth/register"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Skip if Supabase env vars aren't configured (demo mode)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your_supabase") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("your_supabase") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.split(".").length !== 3
  ) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res = NextResponse.next({ request: req });
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user = null;
  try {
    // Use getUser() (not getSession()) for server-side security
    const authResult = await supabase.auth.getUser();
    user = authResult.data.user;
  } catch (error) {
    console.error("Middleware auth/JWT check failed:", error);
    return res;
  }

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isOwnerRoute = OWNER_ROUTES.some((r) => pathname.startsWith(r));
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Redirect logged-in users away from auth pages
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtected) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based access control for owner/admin routes
  if (user && (isOwnerRoute || isAdminRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (isAdminRoute && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (isOwnerRoute && !["salon_owner", "admin"].includes(profile?.role ?? "")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

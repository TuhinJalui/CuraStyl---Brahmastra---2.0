import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Use NEXT_PUBLIC_SITE_URL for consistent redirect behavior
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Auto-save profile details from Google OAuth
      const meta = data.user.user_metadata ?? {};
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? "",
          full_name: meta.full_name ?? meta.name ?? data.user.email?.split("@")[0] ?? "",
          avatar_url: meta.avatar_url ?? meta.picture ?? null,
          phone: meta.phone ?? null,
          role: "customer",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (profileError) {
        console.error("❌ Failed to create/update profile:", profileError);
      } else {
        console.log("✅ Profile created/updated successfully");
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(
    `${siteUrl}/auth/login?error=auth_callback_failed`
  );
}

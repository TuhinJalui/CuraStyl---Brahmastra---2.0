import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

async function verifyAdmin(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

// GET /api/admin/users
export async function GET() {
  const supabase = await getSupabase();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data ?? [];
  const stats = {
    total: users.length,
    customers: users.filter((u: { role: string }) => u.role === "customer").length,
    salonOwners: users.filter((u: { role: string }) => u.role === "salon_owner").length,
    admins: users.filter((u: { role: string }) => u.role === "admin").length,
  };

  return NextResponse.json({ users, stats });
}

// PATCH /api/admin/users — update role
export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId, role } = await req.json();

  if (!userId || !role || !["customer", "salon_owner", "admin"].includes(role)) {
    return NextResponse.json({ error: "userId and valid role required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id, full_name, role")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

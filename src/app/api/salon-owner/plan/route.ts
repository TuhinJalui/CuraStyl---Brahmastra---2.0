import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const PLANS = {
  free: {
    name: "Free",
    price: 0,
    tier: "free",
    services: 5,
    staff: 3,
    photos: 3,
    analytics: "basic",
    featured: false,
    priorityRanking: false,
    customBookingUrl: false,
    ai: false,
    whatsappReminders: false,
    exportReports: false,
    support: "Community",
    color: "gray",
    emoji: "🆓",
  },
  premium: {
    name: "Premium",
    price: 999,
    tier: "premium",
    services: 20,
    staff: 10,
    photos: 10,
    analytics: "advanced",
    featured: true,
    priorityRanking: true,
    customBookingUrl: true,
    ai: false,
    whatsappReminders: false,
    exportReports: false,
    support: "Email Priority",
    color: "purple",
    emoji: "⭐",
  },
  ultra: {
    name: "Ultra Premium",
    price: 2499,
    tier: "ultra",
    services: -1, // unlimited
    staff: -1,
    photos: 30,
    analytics: "full",
    featured: true,
    priorityRanking: true,
    customBookingUrl: true,
    ai: true,
    whatsappReminders: true,
    exportReports: true,
    support: "Priority 24/7",
    color: "gold",
    emoji: "👑",
  },
};

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

// GET /api/salon-owner/plan — get current plan + all plan info
export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data: salon } = await supabase
    .from("salons")
    .select("id, plan_tier, plan_expires_at, name")
    .eq("owner_id", user.id)
    .single();

  if (!salon) return NextResponse.json({ error: "No salon found" }, { status: 404 });

  const currentTier = (salon.plan_tier as keyof typeof PLANS) ?? "free";
  const current = PLANS[currentTier] ?? PLANS.free;

  // Get usage stats
  const [{ count: serviceCount }, { count: staffCount }] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salon.id).eq("is_active", true),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salon.id).eq("is_active", true),
  ]);

  return NextResponse.json({
    current,
    plans: Object.values(PLANS),
    usage: {
      services: serviceCount ?? 0,
      staff: staffCount ?? 0,
    },
    planExpiresAt: salon.plan_expires_at,
  });
}

// POST /api/salon-owner/plan — upgrade plan (mock for now, real payment via Razorpay)
export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { tier } = await req.json();
  if (!tier || !PLANS[tier as keyof typeof PLANS]) {
    return NextResponse.json({ error: "Invalid plan tier" }, { status: 400 });
  }

  const { data: salon } = await supabase
    .from("salons")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!salon) return NextResponse.json({ error: "No salon found" }, { status: 404 });

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { error } = await supabase
    .from("salons")
    .update({
      plan_tier: tier,
      plan_expires_at: expiresAt.toISOString(),
    })
    .eq("id", salon.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send congratulation notification to owner
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "plan_upgrade",
    title: `🎉 Plan Upgraded to ${PLANS[tier as keyof typeof PLANS].name}!`,
    message: `Your salon is now on the ${PLANS[tier as keyof typeof PLANS].name} plan. Enjoy all the new features!`,
    link: "/salon-owner/dashboard",
    is_read: false,
  });

  return NextResponse.json({
    success: true,
    plan: PLANS[tier as keyof typeof PLANS],
    message: `Successfully upgraded to ${PLANS[tier as keyof typeof PLANS].name}!`,
  });
}

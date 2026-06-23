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

// POST /api/bookings/[id]/verify-qr
// Called by the salon owner's dashboard when they scan a customer QR code.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabase();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Fetch the booking with salon + service + user info
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_id,
      user_id,
      salon_id,
      status,
      qr_verified,
      time_slot,
      booking_date,
      salon:salons(id, name, owner_id),
      service:services(name)
    `)
    .eq("id", id)
    .single();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Verify the caller is the salon owner
  const salon = booking.salon as any;
  if (salon?.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the salon owner can verify QR codes" }, { status: 403 });
  }

  // Already verified
  if (booking.qr_verified) {
    return NextResponse.json({ message: "Already verified", booking });
  }

  // Update booking: mark verified + set status to completed
  const { data: updated, error: updateErr } = await supabase
    .from("bookings")
    .update({
      qr_verified: true,
      qr_scanned_at: new Date().toISOString(),
      status: "completed",
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Send a "you've been checked in" notification to the customer
  const service = booking.service as any;
  const salonName = salon?.name ?? "the salon";
  const serviceName = service?.name ?? "your service";

  await supabase.from("notifications").insert({
    user_id: booking.user_id,
    type: "qr_verified",
    title: "✅ Checked In Successfully!",
    message: `The salon owner at ${salonName} has verified your arrival for ${serviceName}. Enjoy your session! 🎉`,
    link: "/dashboard/bookings",
    is_read: false,
  });

  return NextResponse.json({
    success: true,
    message: "QR verified and customer notified",
    booking: updated,
  });
}

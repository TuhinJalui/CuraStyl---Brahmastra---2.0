import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "10:30 AM" / "14:00" style time strings into { hours, minutes } */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  // Handle AM/PM format (e.g. "10:30 AM")
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (period === "AM" && h === 12) h = 0;
    if (period === "PM" && h !== 12) h += 12;
    return { hours: h, minutes: m };
  }
  // Handle 24-hr format (e.g. "14:00")
  const parts = timeStr.split(":");
  return { hours: parseInt(parts[0]), minutes: parseInt(parts[1] ?? "0") };
}

/** Build a Date from booking_date (YYYY-MM-DD) + time_slot string */
function buildAppointmentDate(dateStr: string, timeStr: string): Date {
  const { hours, minutes } = parseTime(timeStr);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/cron/booking-reminders
 *
 * This endpoint should be called by a cron job (e.g. Vercel Cron, GitHub Action,
 * or any scheduler) every 15–30 minutes.
 *
 * It handles TWO types of notifications:
 *   1. REMINDER  – sent 2–3 hours before the appointment.
 *   2. NO-SHOW   – sent 45 min after the slot if the QR was never scanned.
 *
 * Protect with: Authorization: Bearer <CRON_SECRET> header
 *   (set CRON_SECRET in your .env.local)
 */
export async function GET(req: NextRequest) {
  // ── Secret guard ──────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Supabase (service role for unrestricted access) ────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const now = new Date();
  const stats = { reminders: 0, noShows: 0, errors: 0 };

  // ── Fetch confirmed, unverified future bookings (within a rolling 5-day window)
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 1); // 1 day ago (for no-shows)

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 4); // 4 days ahead (for reminders)

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_id,
      user_id,
      booking_date,
      time_slot,
      status,
      qr_verified,
      salon:salons(name),
      service:services(name)
    `)
    .eq("status", "confirmed")
    .eq("qr_verified", false)
    .gte("booking_date", windowStart.toISOString().split("T")[0])
    .lte("booking_date", windowEnd.toISOString().split("T")[0]);

  if (error) {
    console.error("Cron: failed to fetch bookings", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const booking of bookings ?? []) {
    try {
      const salon = booking.salon as any;
      const service = booking.service as any;
      const salonName = salon?.name ?? "the salon";
      const serviceName = service?.name ?? "your service";
      const apptDate = buildAppointmentDate(booking.booking_date, booking.time_slot);
      const diffMs = apptDate.getTime() - now.getTime();
      const diffMins = diffMs / 60000;

      // ── 1. REMINDER: appointment is 90–195 minutes away (1.5 – 3.25 hrs)
      if (diffMins >= 90 && diffMins <= 195) {
        const hoursAway = Math.round(diffMins / 60);

        // Check if reminder already sent (avoid duplicates)
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", booking.user_id)
          .eq("type", "booking_reminder")
          .ilike("message", `%${booking.booking_id}%`)
          .maybeSingle();

        if (!existing) {
          await supabase.from("notifications").insert({
            user_id: booking.user_id,
            type: "booking_reminder",
            title: `⏰ Your salon appointment is in ~${hoursAway} hour${hoursAway !== 1 ? "s" : ""}!`,
            message: `Don't forget! You have ${serviceName} at ${salonName} today at ${booking.time_slot}. Show your QR code at the reception. (Booking: ${booking.booking_id})`,
            link: "/dashboard/bookings",
            is_read: false,
          });
          stats.reminders++;
        }
      }

      // ── 2. NO-SHOW: appointment was > 45 min ago and still unscanned
      if (diffMins < -45) {
        // Check if no-show already sent
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", booking.user_id)
          .eq("type", "no_show_warning")
          .ilike("message", `%${booking.booking_id}%`)
          .maybeSingle();

        if (!existing) {
          await supabase.from("notifications").insert({
            user_id: booking.user_id,
            type: "no_show_warning",
            title: "😔 You missed your salon appointment",
            message: `It looks like you didn't make it to ${salonName} for ${serviceName} at ${booking.time_slot}. Your QR code was not scanned. Please contact the salon if this is a mistake. (Booking: ${booking.booking_id})`,
            link: "/dashboard/bookings",
            is_read: false,
          });

          // Also update booking status to cancelled (no-show)
          await supabase
            .from("bookings")
            .update({ status: "cancelled", cancellation_reason: "No-show: customer did not arrive" })
            .eq("id", booking.id);

          stats.noShows++;
        }
      }
    } catch (e) {
      console.error(`Cron: error processing booking ${booking.id}`, e);
      stats.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    processed: bookings?.length ?? 0,
    ...stats,
    timestamp: now.toISOString(),
  });
}

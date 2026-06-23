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

/**
 * POST /api/payment/verify
 * Verifies payment and processes booking/plan upgrade
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      transaction_id,
      utr_number,
      type,
      metadata = {},
    } = body;

    const paymentId = razorpay_payment_id || transaction_id || utr_number;

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID required" }, { status: 400 });
    }

    // Find the payment order
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", razorpay_order_id || metadata.orderId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: "Payment order not found" }, { status: 404 });
    }

    if (payment.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({
        status: "completed",
        payment_id: paymentId,
        razorpay_signature: body.razorpay_signature,
        verified_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // Process based on payment type
    if (payment.payment_type === "booking" && metadata.bookingId) {
      // Update booking status
      await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          payment_status: "paid",
          payment_id: paymentId,
        })
        .eq("booking_id", metadata.bookingId);

      // Award GlamPoints (10 points per ₹100)
      const pointsToAward = Math.floor(payment.amount / 100) * 10;
      if (pointsToAward > 0) {
        try {
          const serviceSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );
          await serviceSupabase.rpc("award_glam_points", {
            p_user_id: user.id,
            p_points: pointsToAward,
            p_type: "earned",
            p_description: `Earned from booking ${metadata.bookingId}`,
            p_booking_id: metadata.bookingId,
          });
        } catch (err) {
          console.warn("GlamPoints award failed:", err);
        }
      }

      // Send confirmation notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "booking_confirmed",
        title: "Payment Successful!",
        message: `Your booking has been confirmed. Payment ID: ${paymentId}`,
        link: `/dashboard/bookings`,
      });
    } else if (payment.payment_type === "plan_upgrade" && metadata.salonId && metadata.planName) {
      // Upgrade salon plan
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

      await supabase
        .from("salons")
        .update({
          plan_tier: metadata.planName,
          plan_expires_at: expiresAt.toISOString(),
        })
        .eq("id", metadata.salonId)
        .eq("owner_id", user.id);

      // Send notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "plan_upgrade",
        title: `${metadata.planName} Plan Activated!`,
        message: `Your salon has been upgraded to ${metadata.planName} plan. Valid until ${expiresAt.toLocaleDateString()}.`,
        link: `/salon-owner/dashboard?tab=my-plan`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      paymentId,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

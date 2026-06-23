import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

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
 * POST /api/payment/create-order
 * Creates a payment order for Razorpay
 * Since we're using UPI direct, we'll create a simple order record
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, type, metadata } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!type || !["booking", "plan_upgrade"].includes(type)) {
      return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
    }

    // Generate a unique order ID
    const orderId = `order_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    // Create payment record in database
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        order_id: orderId,
        amount,
        currency: "INR",
        status: "created",
        payment_type: type,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating payment record:", error);
      return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
    }

    return NextResponse.json({
      orderId: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      // UPI details
      upiId: "7507075722@mbk",
      // For Razorpay integration (optional)
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_dummy",
    });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

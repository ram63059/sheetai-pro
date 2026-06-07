import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "@/utils/supabase/server";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay keys not configured in environment variables" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { planId } = body;

    // Define pricing plans in USD (cents)
    // Basic: $9 (900 cents)
    // Pro: $19 (1900 cents)
    let amount = 0;
    if (planId === "basic") {
      amount = 900; 
    } else if (planId === "pro") {
      amount = 1900;
    } else {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    const options = {
      amount, // amount in smallest currency unit
      currency: "USD",
      receipt: `receipt_order_${Date.now()}`,
      notes: {
        userId: user.id,
        planId: planId,
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // Send public key to frontend
    });
  } catch (error: unknown) {
    console.error("Error creating Razorpay order:", error);
    return NextResponse.json(
      { error: "Failed to create order", details: (error as Error).message },
      { status: 500 }
    );
  }
}

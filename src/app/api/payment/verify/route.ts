import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      planId 
    } = body;

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return NextResponse.json(
        { error: "Razorpay secret not configured" },
        { status: 500 }
      );
    }

    // Verify signature
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // Payment is verified! Update the user's plan in Supabase
    // We assume there is a 'plan' column in 'profiles'
    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        plan: planId,
        // Optional: you could also increment credits here, but plan is enough if you check plan limits
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      // We still return success for payment, but log the error
      return NextResponse.json(
        { error: "Payment verified but failed to update profile", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Payment verified and plan upgraded!" });
  } catch (error: unknown) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: "Payment verification failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

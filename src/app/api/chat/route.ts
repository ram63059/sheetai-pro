import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { routeChatRequest } from "@/lib/ai-router";

export async function POST(request: Request) {
  try {
    // 1. Verify auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Check credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_remaining, plan")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const effectiveCredits = (!profile.plan || profile.plan === 'free') ? 0 : profile.credits_remaining;

    if (effectiveCredits <= 0) {
      return NextResponse.json(
        {
          error:
            "You have used all your credits or are on a free plan. Please upgrade your plan to use the AI.",
        },
        { status: 429 }
      );
    }

    // 3. Parse request body
    const {
      message,
      dataContext,
      chatHistory,
      chatId,
    }: {
      message: string;
      dataContext: string;
      chatHistory: Array<{
        role: "user" | "model";
        parts: Array<{ text: string }>;
      }>;
      chatId: string;
    } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // 4. Save user message to DB
    if (chatId) {
      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "user",
        content: message,
      });
    }

    // 5. Query AI with Fallback Router
    const aiResponse = await routeChatRequest(
      message,
      dataContext || "",
      chatHistory || []
    );

    // 6. Save AI response to DB
    if (chatId) {
      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: aiResponse,
      });
    }

    // 7. Deduct credit
    await supabase
      .from("profiles")
      .update({
        credits_remaining: profile.credits_remaining - 1,
      })
      .eq("id", user.id);

    return NextResponse.json({
      response: aiResponse,
      creditsRemaining: profile.credits_remaining - 1,
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred while processing your request.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

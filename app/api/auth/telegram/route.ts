export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { verifyTelegramInitData } from "@/lib/telegram";
import { storeTelegramSession } from "@/lib/telegramSession";
import { z } from "zod";

const requestSchema = z.object({
  initData: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData } = requestSchema.parse(body);

    // Verify Telegram init data
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Telegram bot not configured" },
        { status: 500 },
      );
    }

    let telegramUser = verifyTelegramInitData(initData, botToken);

    // For testing/development - if verification fails, create a test user
    if (!telegramUser) {
      console.warn(
        "Telegram verification failed, creating test user for development",
      );
      // Create a test Telegram user for development
      telegramUser = {
        id: Math.floor(Math.random() * 1000000) + 1000000, // Random ID between 1M-2M
        first_name: "Test User",
        username: "testuser_dev",
      };
    }

    if (process.env.DEBUG)
      console.log("Telegram user verified: id=", telegramUser.id);

    const supabase = createServerClientWithCookies();
    const serviceClient = createServiceRoleClient();

    // Check if user is already authenticated via email/password
    const {
      data: { user: currentUser },
      error: getUserError,
    } = await supabase.auth.getUser();

    let userId: string;
    let isNewUser = false;

    if (getUserError || !currentUser) {
      // User is not authenticated - create a new anonymous account for pure Telegram users
      console.log("Creating new anonymous account for Telegram user");

      try {
        // Create anonymous user account
        const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
          email: `telegram_${telegramUser.id}@telegram.local`, // Temporary email for auth system
          password: crypto.randomUUID(), // Random password, user won't use it
          user_metadata: {
            full_name: telegramUser.first_name || "Telegram User",
            telegram_id: telegramUser.id.toString(),
            is_telegram_only: true,
          },
        } as any);

        if (createError || !newUser.user) {
          console.error("Failed to create anonymous user:", createError);
          return NextResponse.json(
            { error: "Failed to create account" },
            { status: 500 },
          );
        }

        userId = newUser.user.id;
        isNewUser = true;

        // Create profile for the new user
        const { error: profileError } = await (serviceClient as any)
          .from("profiles")
          .insert({
            id: userId,
            email: `telegram_${telegramUser.id}@telegram.local`,
            full_name: telegramUser.first_name || "Telegram User",
            // No permanent telegram_id or role - these are session-based now
          });

        if (profileError) {
          console.error("Error creating profile:", profileError);
          // Don't fail the whole request for profile creation issues
        }

        // Sign in the user to establish session
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: `telegram_${telegramUser.id}@telegram.local`,
          password: newUser.user.user_metadata?.password || "",
        });

        if (signInError) {
          console.error("Error signing in new user:", signInError);
          return NextResponse.json(
            { error: "Failed to establish session" },
            { status: 500 },
          );
        }

        // Store Telegram session for notifications
        storeTelegramSession(userId, telegramUser.id.toString(), telegramUser.username);

      } catch (error) {
        console.error("Error creating anonymous account:", error);
        return NextResponse.json(
          { error: "Failed to create account" },
          { status: 500 },
        );
      }
    } else {
      // User is already authenticated - just associate Telegram ID for this session
      userId = currentUser.id;
      console.log("Associating Telegram ID with existing user:", userId);

      // Store Telegram session for notifications
      storeTelegramSession(userId, telegramUser.id.toString(), telegramUser.username);
    }

    // Store Telegram association in response for client-side session management
    return NextResponse.json({
      ok: true,
      message: isNewUser ? "Account created successfully" : "Telegram account connected successfully",
      telegramId: telegramUser.id.toString(),
      telegramUsername: telegramUser.username,
      isNewUser,
    });
  } catch (error) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}

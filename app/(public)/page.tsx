"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [isInTelegram, setIsInTelegram] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const router = useRouter();

  const authenticateWithTelegram = useCallback(async (initData: string) => {
    try {
      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ initData }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);

        // Store Telegram data in session for this session only
        if (data.telegramId) {
          sessionStorage.setItem("telegram_id", data.telegramId);
          if (data.telegramUsername) {
            sessionStorage.setItem("telegram_username", data.telegramUsername);
          }
        }

        // For new users, default to buyer role, for existing users, use their current session role
        let targetRole: string;
        if (data.isNewUser) {
          targetRole = "buyer"; // Default for new Telegram-only users
        } else {
          // Check if user has a session role preference, otherwise default to buyer
          const sessionRole = sessionStorage.getItem("user_role");
          targetRole = sessionRole || "buyer";
        }

        // Store role in session
        sessionStorage.setItem("user_role", targetRole);

        // Handle deep links if present
        const storedDeepLink = sessionStorage.getItem("telegram_deep_link");
        const urlParams = new URLSearchParams(window.location.search);
        const currentStartapp = urlParams.get("startapp");
        const deepLink = storedDeepLink || currentStartapp;

        if (deepLink) {
          sessionStorage.removeItem("telegram_deep_link");

          if (deepLink.startsWith("escrow_")) {
            const code = deepLink.replace("escrow_", "");
            router.push(`/buyer/escrow/${code}`);
            return;
          } else if (deepLink.startsWith("chat_")) {
            const code = deepLink.replace("chat_", "");
            router.push(`/buyer/escrow/${code}`);
            return;
          }
        }

        // Redirect based on role - but allow flexibility
        switch (targetRole) {
          case "admin":
          case "super_admin":
            router.push("/admin/dashboard");
            break;
          case "seller":
            router.push("/seller");
            break;
          case "buyer":
          default:
            router.push("/buyer");
            break;
        }
      } else {
        console.error("Authentication failed");
      }
    } catch (error) {
      console.error("Authentication error:", error);
    }
  }, [router]);

  useEffect(() => {
    // Check for deep link parameters from Telegram miniapp FIRST
    const urlParams = new URLSearchParams(window.location.search);
    const startapp = urlParams.get("startapp");

    if (startapp) {
      // Store deep link parameter for processing after authentication
      sessionStorage.setItem("telegram_deep_link", startapp);
    }

    // Check if user is already authenticated and redirect if so
    const checkExistingAuth = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (user && !error) {
          // Check for stored deep link or current deep link parameters
          const storedDeepLink = sessionStorage.getItem("telegram_deep_link");
          const currentStartapp = urlParams.get("startapp");
          const deepLink = storedDeepLink || currentStartapp;

          if (deepLink) {
            // Clear stored deep link
            sessionStorage.removeItem("telegram_deep_link");

            // Handle deep links: escrow_CODE or chat_CODE
            if (deepLink.startsWith("escrow_")) {
              const code = deepLink.replace("escrow_", "");
              // Redirect to escrow page
              router.push(`/buyer/escrow/${code}`);
              return;
            } else if (deepLink.startsWith("chat_")) {
              const code = deepLink.replace("chat_", "");
              // For chat, we need to find the escrow by code first
              // This will be handled by the escrow page itself
              router.push(`/buyer/escrow/${code}`);
              return;
            }
          }

          // User is already authenticated, get their profile and redirect
          const { data: profile, error: profileError } = await (supabase as any)
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (profile && !profileError) {
            const userProfile = profile as { role: string };
            // Store user info for potential Telegram association
            setAuthenticatedUser(user);
            setUserProfile(userProfile);
            // Don't redirect yet - continue to check for Telegram WebApp
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
      }

      // Check if we're in Telegram WebApp (regardless of auth status)
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;
        setIsInTelegram(true);
        webApp.ready?.();
        webApp.expand?.();

        // Auto-authenticate with Telegram (or associate with existing user)
        const initData = webApp.initData;
        if (initData) {
          authenticateWithTelegram(initData);
          return; // Don't redirect yet, let Telegram auth handle it
        }
      }

      // If we get here, redirect authenticated users to their dashboard
      if (authenticatedUser && userProfile) {
        switch (userProfile.role) {
          case "admin":
          case "super_admin":
            router.push("/admin/dashboard");
            break;
          case "seller":
            router.push("/seller");
            break;
          case "buyer":
          default:
            router.push("/buyer");
            break;
        }
      }
    };

    checkExistingAuth();
  }, [router, authenticateWithTelegram, authenticatedUser, userProfile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div style={{ width: 180, height: 60, position: "relative" }}>
              <Image
                src="/logo-white.png"
                alt="Escroway Logo"
                fill
                style={{ objectFit: "contain" }}
                sizes="180px"
                priority
              />
            </div>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Secure transactions between buyers and sellers with admin oversight
          </p>
          {isInTelegram && (
            <div className="mt-4 p-3 bg-blue-100 rounded-xl text-blue-800">
              {isAuthenticated && " - Authenticated ✅"}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Buyer Card */}
          <div className="card text-center hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold mb-3">I&apos;m a Buyer</h2>
            <p className="text-gray-600 mb-6">
              Join an escrow transaction using a transaction code from the
              seller
            </p>
            <Link href="/buyer" className="btn-primary w-full">
              Enter as Buyer
            </Link>
          </div>

          {/* Seller Card */}
          <div className="card text-center hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">💼</div>
            <h2 className="text-xl font-semibold mb-3">I&apos;m a Seller</h2>
            <p className="text-gray-600 mb-6">
              Create a new escrow transaction and get a unique transaction code
            </p>
            <Link href="/seller" className="btn-primary w-full">
              Enter as Seller
            </Link>
          </div>

          {/* Admin Card */}
          <div className="card text-center hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">👨‍💼</div>
            <h2 className="text-xl font-semibold mb-3">Admin Panel</h2>
            <p className="text-gray-600 mb-6">
              Manage escrow transactions, confirm payments, and handle disputes
            </p>
            <Link href="/admin/login" className="btn-secondary w-full">
              Admin Login
            </Link>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-2xl font-semibold mb-6">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-6 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg mx-auto mb-3">
                1
              </div>
              <h4 className="font-medium mb-2">Create Escrow</h4>
              <p className="text-gray-600">
                Seller creates transaction with details and gets unique code
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg mx-auto mb-3">
                2
              </div>
              <h4 className="font-medium mb-2">Buyer Joins</h4>
              <p className="text-gray-600">
                Buyer enters code, sees details, and makes payment
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg mx-auto mb-3">
                3
              </div>
              <h4 className="font-medium mb-2">Admin Confirms</h4>
              <p className="text-gray-600">
                Admin verifies payment and confirms transaction
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg mx-auto mb-3">
                4
              </div>
              <h4 className="font-medium mb-2">Completion</h4>
              <p className="text-gray-600">
                Product delivered, buyer confirms, funds released
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

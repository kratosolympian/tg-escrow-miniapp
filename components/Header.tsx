"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Debug userProfile changes
  useEffect(() => {
    console.log("[Header] userProfile changed:", userProfile);
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);

    // Check if we're in Telegram WebApp
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      // No longer setting isInTelegram state
    }

    // Simplified auth check - prioritize speed over comprehensive fallback
    const checkAuth = async () => {
      console.log("[Header] Checking auth state...");
      try {
        // First, try the API endpoint (fastest for established sessions)
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          const userData = await response.json();
          if (userData.user) {
            setUser(userData.user);
            setUserProfile(userData.profile || { role: userData.role });
            setAuthChecked(true);
            return;
          }
        }
      } catch (apiError) {
        console.warn("API auth check failed, trying Supabase:", apiError);
      }

      // Fallback to Supabase (slower but more reliable)
      try {
        const { data, error } = await supabase.auth.getUser();
        if (data?.user && !error) {
          console.log(
            "[Header] Auth check successful, user found:",
            data.user.id,
          );
          setUser(data.user);

          // Fetch profile with timeout
          const profilePromise = supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .single();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Profile fetch timeout")), 2000),
          );

          try {
            const { data: profileData } = (await Promise.race([
              profilePromise,
              timeoutPromise,
            ])) as any;
            console.log("[Header] Profile data fetched:", profileData);
            setUserProfile(profileData);
          } catch (profileError) {
            console.warn(
              "[Header] Profile fetch failed, using default role. Error:",
              profileError,
            );
            setUserProfile({ role: "buyer" }); // Default fallback
          }

          setAuthChecked(true);
          return;
        }
      } catch (supabaseError) {
        console.warn("Supabase auth check failed:", supabaseError);
      }

      // No authentication found
      console.log("[Header] No authentication found");
      setUser(null);
      setUserProfile(null);
      setAuthChecked(true);
    };

    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("[Header] Auth state change:", _event, session?.user?.id);
        if (session?.user) {
          setUser(session.user);
          // Simplified profile fetch for auth changes
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", session.user.id)
              .single();
            console.log("[Header] Auth change profile data:", profileData);
            setUserProfile(profileData);
            setAuthChecked(true); // Ensure auth is marked as checked
          } catch (profileError) {
            console.warn(
              "[Header] Failed to fetch user profile on auth change:",
              profileError,
            );
            setUserProfile({ role: "buyer" }); // Default fallback
            setAuthChecked(true);
          }
        } else {
          setUser(null);
          setUserProfile(null);
          setAuthChecked(true);
        }
      },
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const navLog = (kind: string, url?: string) => {
      try {
        console.warn(`[nav-instrument] ${kind}${url ? ` -> ${url}` : ""}`);
        console.trace();
      } catch (e) {}
    };

    const origReplace = window.location.replace?.bind(window.location);
    const origReload = window.location.reload?.bind(window.location);
    const origAssign = (window.location as any).assign?.bind(window.location);

    try {
      if (origReplace) {
        // @ts-ignore
        window.location.replace = (url: string) => {
          navLog("location.replace", url);
          return origReplace(url);
        };
      }
    } catch (e) {}

    try {
      if (origReload) {
        // @ts-ignore
        window.location.reload = () => {
          navLog("location.reload");
          return origReload();
        };
      }
    } catch (e) {}

    try {
      if (origAssign) {
        // @ts-ignore
        (window.location as any).assign = (url: string) => {
          navLog("location.assign", url);
          return origAssign(url);
        };
      }
    } catch (e) {}

    return () => {
      try {
        if (origReplace) (window.location as any).replace = origReplace;
      } catch (e) {}
      try {
        if (origReload) (window.location as any).reload = origReload;
      } catch (e) {}
      try {
        if (origAssign) (window.location as any).assign = origAssign;
      } catch (e) {}
    };
  }, []);

  const handleLogout = async () => {
    console.log("[Header] Logout initiated");
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      console.log("[Header] Auth state cleared locally");

      // For Telegram WebApp, use Telegram's navigation
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        console.log("[Header] Using Telegram WebApp navigation");
        window.location.href = "/";
      } else {
        console.log("[Header] Using standard navigation");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("[Header] Logout error:", error);
      // Fallback navigation
      window.location.href = "/";
    }
  };

  const getLogoHref = () => {
    if (user && userProfile) {
      switch (userProfile.role) {
        case "admin":
        case "super_admin":
          return "/admin/dashboard";
        case "seller":
          return "/seller";
        case "buyer":
        default:
          return "/buyer";
      }
    }
    return "/";
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
        <Link href={getLogoHref()}>
          <span className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Escroway Logo"
              width={36}
              height={36}
              className="rounded"
              priority
            />
            <span className="font-bold text-lg tracking-tight text-blue-700">
              Escroway
            </span>
          </span>
        </Link>
        <nav className="flex gap-2 md:gap-4 items-center flex-wrap">
          {/* Show navigation when logged in */}
          {user && authChecked && (
            <>
              <Link
                href="/settings/profile"
                className="hover:text-blue-700 font-medium text-sm md:text-base"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="ml-2 btn-secondary text-sm font-semibold"
                style={{ minWidth: 70 }}
              >
                Logout
              </button>
            </>
          )}

          {/* Show all links when not logged in */}
          {(!user || !authChecked) && (
            <>
              <Link
                href="/admin/dashboard"
                className="hover:text-blue-700 font-medium text-sm md:text-base"
              >
                Admin
              </Link>
              <Link
                href="/buyer"
                className="hover:text-blue-700 font-medium text-sm md:text-base"
              >
                Buyer
              </Link>
              <Link
                href="/seller"
                className="hover:text-blue-700 font-medium text-sm md:text-base"
              >
                Seller
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

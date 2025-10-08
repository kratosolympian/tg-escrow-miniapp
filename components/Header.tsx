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
  const [isLoading, setIsLoading] = useState(true);

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
      setIsLoading(true);
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
            setIsLoading(false);
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
          setIsLoading(false);
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
      setIsLoading(false);
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
            setAuthChecked(true);
            setIsLoading(false);
          } catch (profileError) {
            console.warn(
              "[Header] Failed to fetch user profile on auth change:",
              profileError,
            );
            setUserProfile({ role: "buyer" }); // Default fallback
            setAuthChecked(true);
            setIsLoading(false);
          }
        } else {
          setUser(null);
          setUserProfile(null);
          setAuthChecked(true);
          setIsLoading(false);
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
    try {
      setIsLoading(true);
      console.log("[Header] Starting logout process");
      await supabase.auth.signOut();
      console.log("[Header] Logout successful");
      // State will be updated by the auth state change listener
    } catch (error) {
      console.error("[Header] Logout failed:", error);
      setIsLoading(false); // Reset loading on error
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
    <>
      {(!authChecked || isLoading) ? (
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="flex items-center space-x-2">
                  <div style={{ width: 32, height: 32, position: "relative" }}>
                    <Image
                      src="/logo.png"
                      alt="Escroway Logo"
                      fill
                      style={{ objectFit: "contain" }}
                      sizes="32px"
                    />
                  </div>
                  <Link href="/" className="text-xl font-bold text-blue-600">
                    Escroway
                  </Link>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="flex items-center space-x-2">
                  <div style={{ width: 32, height: 32, position: "relative" }}>
                    <Image
                      src="/logo.png"
                      alt="Escroway Logo"
                      fill
                      style={{ objectFit: "contain" }}
                      sizes="32px"
                    />
                  </div>
                  <Link href="/" className="text-xl font-bold text-blue-600">
                    Escroway
                  </Link>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {user ? (
                  <>
                    <Link
                      href="/settings/profile"
                      className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      disabled={isLoading}
                      className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {isLoading ? "Logging out..." : "Logout"}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/admin/login"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Staff
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>
      )}
    </>
  );
}

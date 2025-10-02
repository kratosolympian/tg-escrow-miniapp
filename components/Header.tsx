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

  useEffect(() => {
    setMounted(true);
    
    // Check authentication state with retry logic
    const checkAuth = async (retryCount = 0) => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(data.user);
          
          // Fetch user profile to get role
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', data.user.id)
              .single();
            setUserProfile(profileData);
          } catch (profileError) {
            console.warn('Failed to fetch user profile:', profileError);
            setUserProfile(null);
          }
          
          setAuthChecked(true);
          return;
        }
        
        // If no user from Supabase, try the API endpoint as fallback
        if (!error && retryCount < 2) {
          try {
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            if (response.ok) {
              const userData = await response.json();
              if (userData.user) {
                setUser(userData.user);
                
                // Try to get profile from API response or fetch separately
                if (userData.profile) {
                  setUserProfile(userData.profile);
                } else {
                  try {
                    const profileResponse = await fetch('/api/profile/banking', { credentials: 'include' });
                    if (profileResponse.ok) {
                      const profileData = await profileResponse.json();
                      setUserProfile(profileData.profile);
                    }
                  } catch (profileError) {
                    console.warn('Failed to fetch user profile from API:', profileError);
                  }
                }
                
                setAuthChecked(true);
                return;
              }
            }
          } catch (apiError) {
            console.warn('API auth check failed:', apiError);
          }
        }
        
        if (!error && retryCount < 2) {
          // Retry once more after a short delay if no error but no user
          setTimeout(() => checkAuth(retryCount + 1), 100);
        } else {
          setUser(null);
          setUserProfile(null);
          setAuthChecked(true);
        }
      } catch (error) {
        console.error('Header auth check error:', error);
        setUser(null);
        setUserProfile(null);
        setAuthChecked(true);
      }
    };
    
    checkAuth();
    
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        
        // Fetch user profile when auth state changes
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          setUserProfile(profileData);
        } catch (profileError) {
          console.warn('Failed to fetch user profile on auth change:', profileError);
          setUserProfile(null);
        }
        
        setAuthChecked(true);
      } else {
        // When signed out, also check API to be sure
        setUser(null);
        setUserProfile(null);
        setAuthChecked(true);
      }
    });
    
    // Also check auth on window focus (helps when user switches tabs)
    // Debounce the focus handler to avoid repeated calls when focus events
    // fire rapidly (some platforms generate multiple focus events).
    const focusTimer = { current: 0 as any }
    const handleFocus = () => {
      try {
        if (focusTimer.current) clearTimeout(focusTimer.current)
      } catch (e) {}
      focusTimer.current = setTimeout(() => {
        checkAuth()
      }, 250)
    }

    window.addEventListener('focus', handleFocus as any);
    
    return () => {
  listener?.subscription.unsubscribe();
  try { window.removeEventListener('focus', handleFocus as any) } catch (e) {}
    };
  }, []);

  // Debugging instrumentation: capture calls to location.replace/assign/reload across the app.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const navLog = (kind: string, url?: string) => {
      try {
        console.warn(`[nav-instrument] ${kind}${url ? ` -> ${url}` : ''}`)
        console.trace()
      } catch (e) {}
    }

    const origReplace = window.location.replace?.bind(window.location)
    const origReload = window.location.reload?.bind(window.location)
    const origAssign = (window.location as any).assign?.bind(window.location)

    try {
      if (origReplace) {
        // @ts-ignore
        window.location.replace = (url: string) => {
          navLog('location.replace', url)
          return origReplace(url)
        }
      }
    } catch (e) {}

    try {
      if (origReload) {
        // @ts-ignore
        window.location.reload = () => {
          navLog('location.reload')
          return origReload()
        }
      }
    } catch (e) {}

    try {
      if (origAssign) {
        // @ts-ignore
        ;(window.location as any).assign = (url: string) => {
          navLog('location.assign', url)
          return origAssign(url)
        }
      }
    } catch (e) {}

    return () => {
      try { if (origReplace) (window.location as any).replace = origReplace } catch (e) {}
      try { if (origReload) (window.location as any).reload = origReload } catch (e) {}
      try { if (origAssign) (window.location as any).assign = origAssign } catch (e) {}
    }
  }, [])

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      window.location.href = "/";
    }
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
        <Link href="/">
          <span className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Escroway Logo"
              width={36}
              height={36}
              className="rounded"
              priority
            />
            <span className="font-bold text-lg tracking-tight text-blue-700">Escroway</span>
          </span>
        </Link>
        <nav className="flex gap-2 md:gap-4 items-center flex-wrap">
          {/* Show loading state while checking auth */}
          {!authChecked && (
            <div className="animate-pulse flex gap-2">
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
            </div>
          )}

          {/* Show role-based navigation links */}
          {authChecked && user && userProfile && (
            <>
              {userProfile.role === 'buyer' && (
                <Link href="/buyer" className="hover:text-blue-700 font-medium text-sm md:text-base">Buyer Portal</Link>
              )}
              {userProfile.role === 'seller' && (
                <Link href="/seller" className="hover:text-blue-700 font-medium text-sm md:text-base">Seller Portal</Link>
              )}
              {(userProfile.role === 'admin' || userProfile.role === 'super_admin') && (
                <Link href="/admin/dashboard" className="hover:text-blue-700 font-medium text-sm md:text-base">Admin</Link>
              )}
              <Link href="/settings/profile" className="hover:text-blue-700 font-medium text-sm md:text-base">Profile</Link>
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
          {authChecked && !user && (
            <>
              <Link href="/admin/dashboard" className="hover:text-blue-700 font-medium text-sm md:text-base">Admin</Link>
              <Link href="/buyer" className="hover:text-blue-700 font-medium text-sm md:text-base">Buyer</Link>
              <Link href="/seller" className="hover:text-blue-700 font-medium text-sm md:text-base">Seller</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";


export default function Header() {
  const [user, setUser] = useState<any | null>(null);
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
          setAuthChecked(true);
        }
      } catch (error) {
        console.error('Header auth check error:', error);
        setUser(null);
        setAuthChecked(true);
      }
    };
    
    checkAuth();
    
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setAuthChecked(true);
      } else {
        // When signed out, also check API to be sure
        setUser(null);
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
      window.location.href = "/";
    }
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
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
        <nav className="flex gap-4 items-center">
          <Link href="/admin/dashboard" className="hover:text-blue-700 font-medium">Admin</Link>
          <Link href="/buyer" className="hover:text-blue-700 font-medium">Buyer</Link>
          <Link href="/seller" className="hover:text-blue-700 font-medium">Seller</Link>
          {authChecked && user && (
            <>
              <Link href="/settings/profile" className="hover:text-blue-700 font-medium">Profile</Link>
              <button
                onClick={handleLogout}
                className="ml-2 btn-secondary text-sm font-semibold"
                style={{ minWidth: 80 }}
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

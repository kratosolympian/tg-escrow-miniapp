"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";


export default function Header() {
  const [user, setUser] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

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
          {mounted && user && (
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

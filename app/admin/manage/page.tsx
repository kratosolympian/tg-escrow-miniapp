"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import AdminManagement from "@/components/AdminManagement";

interface User {
  id: string;
  email?: string;
  role?: string;
}

export default function AdminManagementPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      // Get current user from Supabase client
      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUser({
          id: data.user.id,
          email: data.user.email ?? undefined,
        });

        // Also fetch user profile to ensure auth state is refreshed
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (response.ok) {
          const userData = await response.json();
          // This helps ensure the Header component detects the user
        }
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading admin management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Admin Management
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/settings" className="btn-secondary">
              ⚙️ Settings
            </Link>
            {currentUser && (
              <button onClick={handleLogout} className="btn-secondary">
                🚪 Logout
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-4xl">
        <AdminManagement
          currentUserEmail={currentUser?.email}
          onAdminUpdate={() => {
            // Refresh or update any parent state if needed
          }}
        />
      </div>
    </div>
  );
}

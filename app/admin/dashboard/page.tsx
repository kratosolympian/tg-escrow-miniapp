"use client";
import React from "react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";
import { getStatusLabel, getStatusColor } from "@/lib/status";
import StatusBadge from "@/components/StatusBadge";
import AdminManagement from "@/components/AdminManagement";
import { supabase } from "@/lib/supabaseClient";
import { useNotifications } from "@/components/NotificationContext";

interface Escrow {
  id: string;
  code: string;
  description: string;
  price: number;
  admin_fee: number;
  status: string;
  created_at: string;
  seller?: { telegram_id: string };
  buyer?: { telegram_id: string };
  receipts?: Array<{ id: string }>;
}

export default function AdminDashboard() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "transactions" | "admin-management"
  >("transactions");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  // Notification system
  const { refreshData } = useNotifications();

  // Refresh function for notifications
  const refreshEscrows = async () => {
    await fetchEscrows();
  };

  // Set refresh function in notification context
  useEffect(() => {
    if (refreshData) {
      refreshData.current = refreshEscrows;
    }
  }, [refreshData]);

  // Real-time subscription for all escrow updates (admins see all)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("escrow-updates-admin")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "escrows",
        },
        (payload) => {
          // Any escrow was updated, refresh the data
          fetchEscrows();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "escrows",
        },
        (payload) => {
          // New escrow was created, refresh the data
          fetchEscrows();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchEscrows = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.append("status", filter);
      if (search) params.append("q", search);
      params.append("limit", "50");

      const response = await fetch(`/api/admin/escrows?${params}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setEscrows(data.escrows);
      }
    } catch (error) {
      console.error("Error fetching escrows:", error);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchEscrows();
    detectCurrentUser();
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data } = await supabase.auth.getUser();
        setUser(data?.user ?? null);
        // Also fetch user profile to ensure auth state is refreshed
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (response.ok) {
          const userData = await response.json();
          // This helps ensure the Header component detects the user
        }
      } catch (e) {
        console.error("Failed to get user on mount", e);
      }
    })();
    // No-op in production: avoid client-side debug logs
  }, [filter, search, fetchEscrows]);

  const detectCurrentUser = async () => {
    try {
      // Get current user email from Supabase client and expose to child components
      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email ?? null;
      setCurrentUserEmail(email);
    } catch (error) {
      console.error("Error detecting current user:", error);
    }
  };

  const handleAdminAction = async (escrowId: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action.replace('-', ' ')} this escrow?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ escrowId }),
        credentials: 'include',
      });

      if (response.ok) {
        alert(`Successfully ${action.replace('-', ' ')} escrow`);
        fetchEscrows(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to ${action}: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      alert(`Failed to ${action}: Network error`);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear client session
      await supabase.auth.signOut();
      // Call server-side logout for cookie/session cleanup
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
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link href="/admin/settings" className="btn-secondary">
              ⚙️ Settings
            </Link>
            {/* Logout button removed; now in header only */}
            {/* Debug: show detected current user email */}
            {currentUserEmail && (
              <div className="text-sm text-gray-500 ml-2">
                {currentUserEmail}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab("transactions")}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === "transactions"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span role="img" aria-label="Transactions">
                  📊
                </span>{" "}
                Transactions
              </button>
              <button
                onClick={() => setActiveTab("admin-management")}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === "admin-management"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span role="img" aria-label="Admin Management">
                  👑
                </span>{" "}
                Admin Management
              </button>
            </nav>
            <Link
              href="/admin/escrow"
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow transition-colors text-base whitespace-nowrap self-start sm:self-auto"
            >
              <span role="img" aria-label="Escrow Management" className="mr-2">
                🗂️
              </span>
              Escrow Management
            </Link>
          </div>
        </div>

        {activeTab === "transactions" && (
          <>
            {/* Filters */}
            <div className="card mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="input max-w-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="waiting_admin">Waiting Admin</option>
                  <option value="payment_confirmed">Payment Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="card text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Total Transactions
                </h3>
                <p className="text-2xl font-bold">{escrows.length}</p>
              </div>
              <div className="card text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Pending Review
                </h3>
                <p className="text-2xl font-bold text-yellow-600">
                  {escrows.filter((e) => e.status === "waiting_admin").length}
                </p>
              </div>
              <div className="card text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Completed
                </h3>
                <p className="text-2xl font-bold text-green-600">
                  {
                    escrows.filter(
                      (e) => e.status === "completed" || e.status === "closed",
                    ).length
                  }
                </p>
              </div>
              <div className="card text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Total Volume
                </h3>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNaira(
                    escrows.reduce((sum, e) => sum + e.price + e.admin_fee, 0),
                  )}
                </p>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold">
                        Code
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Description
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Parties
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {escrows.map((escrow) => (
                      <tr
                        key={escrow.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm">
                            {escrow.code}
                          </span>
                          {escrow.receipts && escrow.receipts.length > 0 && (
                            <span className="ml-2 text-blue-600">📄</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div
                            className="max-w-xs truncate"
                            title={escrow.description}
                          >
                            {escrow.description}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <div>
                              {formatNaira(escrow.price + escrow.admin_fee)}
                            </div>
                            <div className="text-gray-500">
                              ({formatNaira(escrow.price)} +{" "}
                              {formatNaira(escrow.admin_fee)})
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            status={escrow.status as any}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div>S: @{escrow.seller?.telegram_id || "N/A"}</div>
                          <div>B: @{escrow.buyer?.telegram_id || "None"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/admin/escrow/${escrow.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              View Details
                            </Link>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {escrow.status === 'waiting_admin' && (
                                <button
                                  onClick={() => handleAdminAction(escrow.id, 'confirm-payment')}
                                  className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"
                                  title="Confirm Payment"
                                >
                                  ✅ Confirm
                                </button>
                              )}
                              {escrow.status === 'payment_confirmed' && (
                                <button
                                  onClick={() => handleAdminAction(escrow.id, 'release-funds')}
                                  className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                                  title="Release Funds"
                                >
                                  💰 Release
                                </button>
                              )}
                              {(escrow.status === 'waiting_admin' || escrow.status === 'payment_confirmed') && (
                                <button
                                  onClick={() => handleAdminAction(escrow.id, 'refund')}
                                  className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
                                  title="Refund to Buyer"
                                >
                                  ↩️ Refund
                                </button>
                              )}
                              {escrow.status !== 'on_hold' && escrow.status !== 'completed' && escrow.status !== 'refunded' && (
                                <button
                                  onClick={() => handleAdminAction(escrow.id, 'put-on-hold')}
                                  className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200"
                                  title="Put on Hold"
                                >
                                  ⏸️ Hold
                                </button>
                              )}
                              {escrow.status === 'on_hold' && (
                                <button
                                  onClick={() => handleAdminAction(escrow.id, 'take-off-hold')}
                                  className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded hover:bg-purple-200"
                                  title="Take Off Hold"
                                >
                                  ▶️ Resume
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {escrows.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No transactions found</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "admin-management" && (
          <AdminManagement
            currentUserEmail={currentUserEmail || undefined}
            onAdminUpdate={() => {
              // Refresh or update any parent state if needed
            }}
          />
        )}
      </div>
    </div>
  );
}

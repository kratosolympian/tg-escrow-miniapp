"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { supabase } from "@/lib/supabaseClient";
import { useNotifications } from "@/components/NotificationContext";
import { formatNaira } from "@/lib/utils";

export default function BuyerPage() {
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [activeEscrows, setActiveEscrows] = useState<Array<any>>([]);
  const [historicalEscrows, setHistoricalEscrows] = useState<Array<any>>([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [jumpToPage, setJumpToPage] = useState('');
  const [blockedJoinInfo, setBlockedJoinInfo] = useState<any | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Notification system
  const { refreshData } = useNotifications();

  // Refresh function for notifications
  const refreshEscrows = async () => {
    await fetchActiveEscrows();
    await fetchHistoricalEscrows();
  };

  // Set refresh function in notification context
  useEffect(() => {
    if (refreshData) {
      refreshData.current = refreshEscrows;
    }
  }, [refreshData]);

  // Real-time subscription for escrow updates
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const channel = supabase
      .channel("escrow-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "escrows",
        },
        (payload) => {
          // Check if this escrow belongs to the current user
          if (
            payload.new &&
            (payload.new.seller_id === user.id ||
              payload.new.buyer_id === user.id)
          ) {
            // Escrow was updated and belongs to this user, refresh the data
            fetchActiveEscrows();
          }
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
          // Check if this new escrow belongs to the current user
          if (
            payload.new &&
            (payload.new.seller_id === user.id ||
              payload.new.buyer_id === user.id)
          ) {
            // New escrow was created for this user, refresh the data
            fetchActiveEscrows();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user]);

  // Check authentication on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First try getSession (more reliable than getUser for established sessions)
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          setIsAuthenticated(true);
          setShowAuthForm(false);
          setUser(sessionData.session.user);
          return;
        }

        // Fallback to getUser
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userData?.user) {
          setIsAuthenticated(true);
          setShowAuthForm(false);
          setUser(userData.user);
          return;
        }

        // If neither worked, show auth form
        setIsAuthenticated(false);
        setUser(null);
        setShowAuthForm(true);
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
        setUser(null);
        setShowAuthForm(true);
      }
    };

    checkAuth();
    fetchActiveEscrows();
    fetchHistoricalEscrows();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setIsAuthenticated(true);
          setShowAuthForm(false);
          setUser(session.user);
          // Fetch active escrows when user authenticates
          fetchActiveEscrows();
          fetchHistoricalEscrows();
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setShowAuthForm(true);
          setActiveEscrows([]);
        }
      },
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const fetchActiveEscrows = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/escrow/my-active", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (res.ok) {
        const j = await res.json();
        setActiveEscrows(j.buyer || []);
        setLastRefreshTime(new Date()); // Update refresh timestamp
      }
    } catch (e) {
      // ignore
    }
  };

  const fetchHistoricalEscrows = async (page: number = 1) => {
    try {
      setHistoryLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/escrow/my-history?page=${page}&limit=5`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (res.ok) {
        const j = await res.json();
        const allHistorical = [...(j.seller || []), ...(j.buyer || [])];
        setHistoricalEscrows(allHistorical);
        // Keep requested page in sync with server response
        setHistoryPagination((prev) => ({ ...prev, ...(j.pagination || {}), page }));
      }
    } catch (e) {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

    const goToHistoryPage = (requested: number) => {
      const total = historyPagination.totalPages || 1;
      const page = Math.max(1, Math.min(requested, total));
      if (page === historyPagination.page) return;
      fetchHistoricalEscrows(page);
    };

    const handlePageJump = () => {
      const pageNum = parseInt(jumpToPage);
      if (isNaN(pageNum) || pageNum < 1 || pageNum > (historyPagination.totalPages || 1)) {
        return;
      }
      goToHistoryPage(pageNum);
      setJumpToPage('');
    };

  // Handle authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError("");
    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) {
          setError(error.message || "Authentication failed");
        } else if (data.user) {
          setIsAuthenticated(true);
          setShowAuthForm(false);
          setUser(data.user);
          setAuthForm({ email: "", password: "", name: "" });
          // Fetch active escrows after login
          fetchActiveEscrows();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) {
          setError(error.message || "Signup failed");
        } else if (data.user) {
          setIsAuthenticated(true);
          setShowAuthForm(false);
          setUser(data.user);
          setAuthForm({ email: "", password: "", name: "" });
          // Fetch active escrows after signup
          fetchActiveEscrows();
        }
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      setShowAuthForm(true);
    } catch (error) {
      // ignore
    } finally {
      setAuthLoading(false);
    }
  };
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoinEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    setLoading(true);
    if (!isAuthenticated) {
      setShowAuthForm(true);
      setLoading(false);
      return;
    }
    try {
      const response = await doJoin(code.trim());
      if (response.ok) {
        router.replace(`/buyer/escrow/${code.trim().toUpperCase()}`);
        return;
      }
      const data = await response.json().catch(() => null);
      // If already joined, fetch escrow details and redirect
      if (
        data?.error &&
        typeof data.error === "string" &&
        data.error.toLowerCase().includes("already joined")
      ) {
        // Try to fetch escrow details
        const escrowResp = await fetch(
          `/api/escrow/by-id/${code.trim().toUpperCase()}`,
          { credentials: "include" },
        );
        if (escrowResp.ok) {
          router.replace(`/buyer/escrow/${code.trim().toUpperCase()}`);
          return;
        } else {
          setError(
            "You have already joined, but escrow details could not be loaded.",
          );
          setLoading(false);
          return;
        }
      }
      if (data?.blockedReason || data?.activeEscrows) {
        setBlockedJoinInfo({
          reason: data.blockedReason || data.error,
          escrows: data.activeEscrows || [],
        });
      } else {
        setError(
          data?.error ||
            data?.message ||
            "Failed to join transaction. Please check the code and try again.",
        );
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetryJoin = async () => {
    setError("");
    setBlockedJoinInfo(null);
    if (!code.trim()) return;
    setLoading(true);
    try {
      const resp = await doJoin(code.trim());
      if (resp.ok) {
        router.replace(`/buyer/escrow/${code.trim().toUpperCase()}`);
        return;
      }
      const data = await resp.json().catch(() => null);
      // If already joined, fetch escrow details and redirect
      if (
        data?.error &&
        typeof data.error === "string" &&
        data.error.toLowerCase().includes("already joined")
      ) {
        const escrowResp = await fetch(
          `/api/escrow/by-id/${code.trim().toUpperCase()}`,
          { credentials: "include" },
        );
        if (escrowResp.ok) {
          router.replace(`/buyer/escrow/${code.trim().toUpperCase()}`);
          return;
        } else {
          setError(
            "You have already joined, but escrow details could not be loaded.",
          );
          setLoading(false);
          return;
        }
      }
      setError(data?.error || "Retry failed. Please try again later.");
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to perform join POST (returns fetch Response)
  async function doJoin(joinCode: string, oneTimeToken?: string) {
    const body: any = { code: joinCode };
    if (oneTimeToken) body.__one_time_token = oneTimeToken;
    const res = await fetch("/api/escrow/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });

    // ...removed for production: debugJoin...

    return res;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🛒 Buyer Portal
          </h1>
          <p className="text-gray-600">
            Enter your transaction code to join an escrow
          </p>
          {/* Remove in-content Logout button, rely on header only */}
        </div>

        {blockedJoinInfo && (
          <div className="card mb-6">
            <div className="p-4">
              <h3 className="font-semibold mb-2">
                Can&apos;t join transaction
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                {blockedJoinInfo.reason ||
                  "Joining this transaction is not allowed."}
              </p>
              {blockedJoinInfo.escrows &&
                blockedJoinInfo.escrows.length > 0 && (
                  <div className="space-y-2">
                    {blockedJoinInfo.escrows.map((e: any) => (
                      <div
                        key={e.id}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <div>
                          <div className="font-mono font-bold">{e.code}</div>
                          <div className="text-sm text-gray-600">
                            {e.status}
                          </div>
                        </div>
                        <Link
                          href={`/buyer/escrow/${e.code}`}
                          className="btn-primary"
                        >
                          Open
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        <div className="card">
          {showAuthForm ? (
            <AuthCard
              authMode={authMode}
              authForm={authForm}
              authLoading={authLoading}
              error={error}
              onChange={(e) =>
                setAuthForm((prev) => ({
                  ...prev,
                  [e.target.name]: e.target.value,
                }))
              }
              onSubmit={handleAuth}
              setAuthMode={(m) => {
                setAuthMode(m);
                setError("");
              }}
            />
          ) : (
            <form onSubmit={handleJoinEscrow} className="space-y-6">
              <div>
                <label htmlFor="code" className="label">
                  Transaction Code
                </label>
                <input
                  type="text"
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter transaction code"
                  className="input"
                  required
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Get this code from the seller
                </p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                  <div className="mb-2">{error}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRetryJoin}
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading ? "Retrying..." : "Retry"}
                    </button>
                    <button
                      onClick={() => {
                        setError("");
                        setBlockedJoinInfo(null);
                      }}
                      className="btn-secondary"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="btn-primary w-full"
              >
                {loading ? "Joining..." : "Join Transaction"}
              </button>
            </form>
          )}
        </div>

        {/* Ongoing Transactions Section - Always show when authenticated */}
        {isAuthenticated && (
          <div className="card mt-6">
            <div className="p-4">
              <h3 className="font-semibold mb-3">Your Transactions</h3>
              {lastRefreshTime && (
                <div className="text-xs text-green-600 mb-2">
                  🔄 Last updated: {lastRefreshTime.toLocaleTimeString()}
                </div>
              )}
              {activeEscrows && activeEscrows.length > 0 ? (
                <div className="space-y-3">
                  {activeEscrows.map((e) => (
                    <div
                      key={e.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-mono font-bold text-lg text-gray-900">
                            {e.code}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Status:{" "}
                            <span className="capitalize">
                              {e.status?.replace("_", " ") || "Unknown"}
                            </span>
                          </div>
                          {e.description && (
                            <div className="text-sm text-gray-500 mt-1 truncate max-w-xs">
                              {e.description}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/buyer/escrow/${e.code}`}
                          className="btn-primary ml-4"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-3">📭</div>
                  <p className="text-gray-600">No ongoing transactions</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Enter a transaction code above to join one
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction History */}
        {isAuthenticated && (
          <div className="card mt-6">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 gap-2">
                <h3 className="font-semibold">Transaction History</h3>
                {historyPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center sm:justify-end space-x-2 flex-wrap gap-2">
                    <button
                      onClick={() => goToHistoryPage(historyPagination.page - 1)}
                      disabled={!historyPagination.hasPrevPage || historyLoading}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors text-sm font-medium min-w-[80px] flex items-center justify-center"
                    >
                      {historyLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Previous'
                      )}
                    </button>
                    <span className="text-sm text-gray-600 px-2">
                      {historyPagination.page} / {historyPagination.totalPages}
                    </span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={jumpToPage}
                        onChange={(e) => setJumpToPage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handlePageJump()}
                        placeholder="Page"
                        min="1"
                        max={historyPagination.totalPages}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handlePageJump}
                        disabled={historyLoading || !jumpToPage.trim()}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded text-xs font-medium"
                      >
                        Go
                      </button>
                    </div>
                    <button
                      onClick={() => goToHistoryPage(historyPagination.page + 1)}
                      disabled={!historyPagination.hasNextPage || historyLoading}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors text-sm font-medium min-w-[80px] flex items-center justify-center"
                    >
                      {historyLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Next'
                      )}
                    </button>
                  </div>
                )}
              </div>

              {historicalEscrows.length > 0 ? (
                <div className="space-y-3">
                  {historicalEscrows.map((escrow: any) => {
                    const price =
                      typeof escrow.price === "number" && !isNaN(escrow.price)
                        ? escrow.price
                        : 0;
                    const isBuyer = escrow.buyer_id === user?.id;
                    return (
                      <div
                        key={escrow.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-mono font-bold text-lg text-gray-900">
                              {escrow.code}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {escrow.description}
                            </div>
                            <div className="text-sm font-medium text-gray-900 mt-1">
                              {formatNaira(price)}
                            </div>
                            {escrow.admin_fee && (
                              <div className="text-sm text-gray-600 mt-1">
                                Service Fee: {formatNaira(escrow.admin_fee)}
                              </div>
                            )}
                            <div className="text-sm text-gray-500 mt-1">
                              Status:{" "}
                              <span className={`capitalize ${
                                escrow.status === 'completed' ? 'text-green-600' :
                                escrow.status === 'refunded' ? 'text-red-600' :
                                'text-gray-600'
                              }`}>
                                {escrow.status.replace("_", " ")}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {isBuyer ? 'Purchased' : 'Sold'} • {new Date(escrow.updated_at || escrow.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <Link
                            href={`/buyer/escrow/${escrow.code}`}
                            className="btn-secondary ml-4"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-3">📭</div>
                  <p className="text-gray-600">No completed transactions yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <h3 className="font-semibold mb-4">How it works:</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">
                1
              </span>
              <p>Enter the transaction code provided by the seller</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">
                2
              </span>
              <p>
                Review product details and total amount (price + service fee)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">
                3
              </span>
              <p>Make payment to the provided bank account</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">
                4
              </span>
              <p>Upload payment receipt for verification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

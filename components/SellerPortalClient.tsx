"use client";
import Image from "next/image";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { formatNaira } from "@/lib/utils";
import { useNotifications } from "@/components/NotificationContext";

interface CreateEscrowForm {
  description: string;
  price: string;
  image?: File;
}

interface CreatedEscrow {
  id: string;
  code: string;
}

interface SellerPortalClientProps {
  initialAuthState?: { user: any; authenticated: boolean } | null;
}

export default function SellerPortalClient({
  initialAuthState,
}: SellerPortalClientProps = {}) {
  const [form, setForm] = useState<CreateEscrowForm>({
    description: "",
    price: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdEscrow, setCreatedEscrow] = useState<CreatedEscrow | null>(
    null,
  );
  const [onlineAdmins, setOnlineAdmins] = useState<Array<any>>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(
    null,
  );
  const [productImagePath, setProductImagePath] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentServiceFee, setCurrentServiceFee] = useState<number>(300);

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
  const [user, setUser] = useState<any>(null);

  const router = useRouter();

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
      .channel("escrow-updates-seller")
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
  const [blockedCreationInfo, setBlockedCreationInfo] = useState<any | null>(
    null,
  );
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const fetchOnlineAdmins = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/online-admins", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setOnlineAdmins(data.admins || []);
      }
    } catch (e) {
      console.error("Error fetching admins", e);
    }
  };

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
        const sellerEscrows = j.seller || [];
        setActiveEscrows(sellerEscrows);
        setLastRefreshTime(new Date()); // Update refresh timestamp
      }
    } catch (e) {
      console.error("Error fetching active escrows", e);
    }
  };

  const fetchHistoricalEscrows = async (page: number = 1) => {
    try {
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
        setHistoryPagination(j.pagination);
      }
    } catch (e) {
      console.error("Error fetching historical escrows", e);
    }
  };

  const fetchCurrentServiceFee = async () => {
    try {
      const response = await fetch("/api/service-fee");
      if (response.ok) {
        const data = await response.json();
        if (data?.service_fee !== undefined) {
          setCurrentServiceFee(data.service_fee);
        }
      }
    } catch (e) {
      console.error("Error fetching service fee", e);
    }
  };

  // Check if the current user has bank details set
  const [hasBankDetails, setHasBankDetails] = useState<boolean | null>(null);

  // Extracted so we can call it after authentication completes
  const checkBank = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/profile/banking", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const profile = data.profile ?? data;
        const hasBank = !!(
          profile &&
          (profile.bank_name ||
            profile.account_number ||
            profile.account_holder_name)
        );
        setHasBankDetails(hasBank);
      } else {
        setHasBankDetails(false);
      }
    } catch (e) {
      console.error("Error checking bank details", e);
      setHasBankDetails(false);
    }
  };

  // Initial auth check and setup
  useEffect(() => {
    if (initialAuthState?.authenticated && initialAuthState.user) {
      setIsAuthenticated(true);
      setUser(initialAuthState.user);
      setShowAuthForm(false);
      return;
    }

    const checkAuth = async () => {
      try {
        // First try getSession (more reliable than getUser for established sessions)
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          setIsAuthenticated(true);
          setUser(sessionData.session.user);
          setShowAuthForm(false);
          return;
        }

        // Fallback to getUser
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userData?.user) {
          setIsAuthenticated(true);
          setUser(userData.user);
          setShowAuthForm(false);
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
    fetchOnlineAdmins();
    fetchActiveEscrows();
    fetchCurrentServiceFee();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setIsAuthenticated(true);
          setUser(session.user);
          setShowAuthForm(false);
          fetchActiveEscrows();
          fetchHistoricalEscrows();
          fetchCurrentServiceFee();
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

  // Fetch active escrows when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveEscrows();
      fetchHistoricalEscrows();
    }
  }, [isAuthenticated]);

  // Handle authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError("");
    try {
      // Use server endpoints which set httpOnly cookies so SSR can observe session
      const endpoint =
        authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload: any = {
        email: authForm.email,
        password: authForm.password,
      };
      if (authMode === "signup" && authForm.name) payload.name = authForm.name;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(json.error || "Authentication failed");
      } else {
        // If we just signed up, the signup endpoint returns a one-time token but
        // does not always set httpOnly cookies. To ensure SSR can observe the
        // session, perform a login POST which will set the cookies on the response.
        const oneTime = json.__one_time_token;
        if (authMode === "signup" && !oneTime) {
          // fallback: attempt explicit login to ensure cookie set
          try {
            await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                email: authForm.email,
                password: authForm.password,
              }),
            });
          } catch (e) {
            // ignore
          }
        }

        setIsAuthenticated(true);
        setUser(json.user || null);
        setShowAuthForm(false);
        try {
          checkBank();
        } catch {}

        // If we received a one-time token, navigate to seller page with token.
        // Use client-side navigation to avoid a full reload; fall back to
        // window.location if router methods are unavailable.
        if (oneTime) {
          try {
            router.replace(
              `/seller?__one_time_token=${encodeURIComponent(oneTime)}`,
            );
            return;
          } catch (e) {
            try {
              window.location.href = `/seller?__one_time_token=${encodeURIComponent(oneTime)}`;
            } catch (e) {}
          }
        }

        // Otherwise refresh the current route so SSR can observe newly-set cookies
        try {
          router.refresh?.();
        } catch (e) {
          try {
            window.location.reload();
          } catch (e) {}
        }
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Telegram authentication (keep as fallback)
  useEffect(() => {
    const authenticateWithTelegram = async () => {
      if (isAuthenticated || !showAuthForm) return;

      try {
        const telegram = window.Telegram?.WebApp;
        const isInTelegram = telegram?.initData;

        if (isInTelegram && telegram) {
          const initData = telegram.initData;

          if (initData) {
            const response = await fetch("/api/auth/telegram", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ initData }),
            });

            if (response.ok) {
              setIsAuthenticated(true);
              setShowAuthForm(false);
              telegram.ready?.();
              telegram.expand?.();
            }
          }
        }
      } catch (error) {
        console.error("Telegram auth error:", error);
      }
    };

    authenticateWithTelegram();
  }, [isAuthenticated, showAuthForm]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      try {
        localStorage.setItem(
          "seller:create-escrow:draft",
          JSON.stringify({
            description: next.description,
            price: next.price,
            selectedAdmin,
            productImagePath,
          }),
        );
      } catch {}
      return next;
    });
  };

  const handleSelectedAdminChange = (id: string) => {
    setSelectedAdmin(id);
    try {
      localStorage.setItem(
        "seller:create-escrow:draft",
        JSON.stringify({
          description: form.description,
          price: form.price,
          selectedAdmin: id,
          productImagePath,
        }),
      );
    } catch {}
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      (async () => {
        try {
          const fd = new FormData();
          fd.append("image", file);
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          const resp = await fetch("/api/escrow/upload-temp", {
            method: "POST",
            body: fd,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            credentials: "include",
          });
          const json = await resp.json().catch(() => null);
          if (resp.ok && json?.path) {
            const path = json.path;
            setProductImagePath(path);
            // Prefer signedUrl returned by upload-temp if provided
            if (json?.signedUrl) {
              setProductImagePreview(json.signedUrl);
            } else {
              try {
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;
                const signResp = await fetch("/api/storage/sign-url", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  credentials: "include",
                  body: JSON.stringify({ path, bucket: "product-images" }),
                });
                const signJson = await signResp.json().catch(() => null);
                if (signResp.ok && signJson?.signedUrl) {
                  setProductImagePreview(signJson.signedUrl);
                }
              } catch (e) {}
            }

            setForm((prev) => ({ ...prev, image: file }));
            try {
              localStorage.setItem(
                "seller:create-escrow:draft",
                JSON.stringify({
                  description: form.description,
                  price: form.price,
                  selectedAdmin,
                  productImagePath: path,
                }),
              );
            } catch {}
          } else {
            setForm((prev) => ({ ...prev, image: file }));
          }
        } catch (err) {
          console.error("Temp upload failed", err);
          setForm((prev) => ({ ...prev, image: file }));
        }
      })();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.price.trim()) return;
    if (hasBankDetails === false) {
      setError("Please complete your bank details before creating an escrow.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("description", form.description.trim());
      const priceValue = Number(form.price);
      formData.append("price", isNaN(priceValue) ? "" : priceValue.toString());
      if (form.image) {
        formData.append("image", form.image);
      }
      if (selectedAdmin) {
        formData.append("assigned_admin_id", selectedAdmin);
      }
      if (productImagePath) {
        formData.append("productImagePath", productImagePath);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch("/api/escrow/create", {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        try {
          if (data?.escrowId) {
            router.push(`/seller/escrow/${data.escrowId}`);
            return;
          }
        } catch (e) {
          // ignore navigation errors
        }
        setCreatedEscrow({ code: data.code, id: data.escrowId });
        try {
          localStorage.removeItem("seller:create-escrow:draft");
        } catch {}
        setBlockedCreationInfo(null);
      } else {
        if (data?.activeEscrow) {
          setActiveEscrows([data.activeEscrow]);
          setBlockedCreationInfo({
            message: data.error || "You already have an ongoing transaction",
            escrow: data.activeEscrow,
          });
          setError("");
        } else {
          setError(data.error || "Failed to create transaction");
        }
      }
    } catch (error) {
      console.error("Error creating escrow:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (createdEscrow) {
      navigator.clipboard.writeText(createdEscrow.code);
    }
  };

  const startNewTransaction = () => {
    setCreatedEscrow(null);
    setForm({ description: "", price: "" });
    try {
      localStorage.removeItem("seller:create-escrow:draft");
    } catch (e) {
      // ignore
    }
    setError("");
  };

  const handleLogout = async () => {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message || "Logout failed");
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setShowAuthForm(true);
        setAuthForm({ email: "", password: "", name: "" });
        setAuthMode("signup");
        setError("");
        router.push("/");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle auth form input changes
  const handleAuthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  if (!isAuthenticated || showAuthForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-6">
        <div className="max-w-2xl mx-auto">
          <AuthCard
            authMode={authMode}
            authForm={authForm}
            authLoading={authLoading}
            error={error}
            onChange={handleAuthInputChange}
            onSubmit={handleAuth}
            setAuthMode={(m) => {
              setAuthMode(m);
              setError("");
            }}
          />
        </div>
      </div>
    );
  }

  // Authenticated UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-800">
            Seller Dashboard
          </h1>
          <p className="text-green-600 mt-1">
            Create and manage your escrow transactions
          </p>
        </div>

        {/* Active Escrows */}
        {activeEscrows.length > 0 && !showCreateForm && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-green-800">
                Active Transactions
              </h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                Create New Transaction
              </button>
            </div>
            {lastRefreshTime && (
              <div className="text-xs text-green-600 mb-2">
                🔄 Last updated: {lastRefreshTime.toLocaleTimeString()}
              </div>
            )}
            <div className="space-y-4">
              {activeEscrows.map((escrow: any) => {
                const price =
                  typeof escrow.price === "number" && !isNaN(escrow.price)
                    ? escrow.price
                    : 0;
                return (
                  <div
                    key={escrow.id}
                    className="bg-white rounded-lg shadow-md p-6 border border-green-100"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg text-green-800">
                          Transaction #{escrow.code}
                        </h3>
                        <p className="text-gray-600 mt-1">
                          {escrow.description}
                        </p>
                        <p className="text-green-600 font-medium mt-2">
                          {formatNaira(price)}
                        </p>
                        {escrow.admin_fee && (
                          <p className="text-sm text-gray-600 mt-1">
                            Service Fee: {formatNaira(escrow.admin_fee)}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Status:{" "}
                          <span className="capitalize">
                            {escrow.status.replace("_", " ")}
                          </span>
                        </p>
                      </div>
                      <Link
                        href={`/seller/escrow/${escrow.id}`}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-green-800">
              Transaction History
            </h2>
            {historyPagination.totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fetchHistoricalEscrows(historyPagination.page - 1)}
                  disabled={!historyPagination.hasPrevPage}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {historyPagination.page} of {historyPagination.totalPages}
                </span>
                <button
                  onClick={() => fetchHistoricalEscrows(historyPagination.page + 1)}
                  disabled={!historyPagination.hasNextPage}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {historicalEscrows.length > 0 ? (
            <div className="space-y-4">
              {historicalEscrows.map((escrow: any) => {
                const price =
                  typeof escrow.price === "number" && !isNaN(escrow.price)
                    ? escrow.price
                    : 0;
                const isSeller = escrow.seller_id === user?.id;
                return (
                  <div
                    key={escrow.id}
                    className="bg-white rounded-lg shadow-md p-6 border border-gray-100"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">
                          Transaction #{escrow.code}
                        </h3>
                        <p className="text-gray-600 mt-1">
                          {escrow.description}
                        </p>
                        <p className="text-gray-600 font-medium mt-2">
                          {formatNaira(price)}
                        </p>
                        {escrow.admin_fee && (
                          <p className="text-sm text-gray-600 mt-1">
                            Service Fee: {formatNaira(escrow.admin_fee)}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Status:{" "}
                          <span className={`capitalize ${
                            escrow.status === 'completed' ? 'text-green-600' :
                            escrow.status === 'refunded' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {escrow.status.replace("_", " ")}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {isSeller ? 'Sold' : 'Purchased'} • {new Date(escrow.updated_at || escrow.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Link
                        href={`/seller/escrow/${escrow.id}`}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100 text-center">
              <p className="text-gray-500">No completed transactions yet.</p>
            </div>
          )}
        </div>

        {/* Create Escrow Form - only show if no active escrows or user clicked create */}
        {((!showCreateForm && activeEscrows.length === 0) || showCreateForm) && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-green-100">
            <h2 className="text-2xl font-bold text-green-800 mb-6">
              Create New Transaction
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-green-800 font-semibold mb-2">
                  Product Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  placeholder="Describe the product or service you're selling"
                  rows={4}
                  required
                />
              </div>

              <div>
                <label className="block text-green-800 font-semibold mb-2">
                  Price (₦)
                </label>
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  placeholder="Enter the transaction amount"
                  min="1"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-green-800 font-semibold mb-2">
                  Product Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
                {productImagePreview && (
                  <div className="mt-4">
                    <Image
                      src={productImagePreview}
                      alt="Product preview"
                      width={320}
                      height={240}
                      className="max-w-xs rounded-lg shadow-md"
                    />
                  </div>
                )}
              </div>

              {onlineAdmins.length > 0 && (
                <div>
                  <label className="block text-green-800 font-semibold mb-2">
                    Assign Admin (Optional)
                  </label>
                  <select
                    value={selectedAdmin || ""}
                    onChange={(e) => handleSelectedAdminChange(e.target.value)}
                    className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Select an admin (optional)</option>
                    {onlineAdmins.map((admin: any) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.full_name || admin.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <span className="text-blue-600">ℹ️</span>
                  <span className="font-medium">
                    Service Fee: {formatNaira(currentServiceFee)}
                  </span>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  This fee will be added to the transaction amount for escrow
                  protection.
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  loading || !form.description.trim() || !form.price.trim()
                }
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl transition-colors text-xl"
              >
                {loading ? "Creating Transaction..." : "Create Transaction"}
              </button>
            </form>
          </div>
        )}

        {/* Blocked Creation Info */}
        {blockedCreationInfo && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              Transaction in Progress
            </h3>
            <p className="text-yellow-700 mb-4">
              {blockedCreationInfo.message}
            </p>
            <Link
              href={`/seller/escrow/${blockedCreationInfo.escrow.id}`}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
            >
              View Active Transaction
            </Link>
          </div>
        )}

        {/* Success State */}
        {createdEscrow && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              Transaction Created Successfully!
            </h3>
            <p className="text-green-700 mb-4">
              Share this code with your buyer to complete the transaction.
            </p>
            <div className="bg-white rounded-lg p-4 border border-green-200 mb-4">
              <p className="text-2xl font-mono font-bold text-center text-green-800">
                {createdEscrow.code}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={copyCode}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                Copy Code
              </button>
              <button
                onClick={startNewTransaction}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

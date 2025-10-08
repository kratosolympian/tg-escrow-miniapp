"use client";

import React, { useEffect, useState } from "react";

interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
  is_super_admin: boolean;
  profile?: { role?: string; telegram_id?: string };
}

interface AdminManagementData {
  success?: boolean;
  // server may return a single `super_admin` or a list; normalize to array
  super_admins?: AdminProfile[];
  super_admin?: AdminProfile | null;
  admins?: AdminProfile[];
  total_count?: number;
  super_admin_count?: number;
  admin_count?: number;
}

interface AdminManagementProps {
  currentUserEmail?: string;
  onAdminUpdate?: () => void;
}

export default function AdminManagement({
  currentUserEmail,
  onAdminUpdate,
}: AdminManagementProps) {
  const [adminData, setAdminData] = useState<AdminManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Only show Add Admin for the canonical super admin (by email) or
  // when the current user appears in the returned `super_admins` list.
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  // User management state
  const [users, setUsers] = useState<AdminProfile[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState<string | null>(
    null,
  );
  // Telegram ID management state
  const [editingTelegramId, setEditingTelegramId] = useState<string | null>(null);
  const [telegramIdValue, setTelegramIdValue] = useState("");

  // Escrow management state
  const [escrows, setEscrows] = useState<any[] | null>(null);
  const [escrowQuery, setEscrowQuery] = useState("");
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowActionLoading, setEscrowActionLoading] = useState<string | null>(
    null,
  );

  // Online/offline toggle state
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [presenceLoading, setPresenceLoading] = useState<boolean>(false);

  const fetchUsers = React.useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      setUsers(json.users || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchEscrows = React.useCallback(async (q?: string) => {
    setEscrowLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", "20");
      const res = await fetch(`/api/admin/escrows?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch escrows");
      const json = await res.json();
      setEscrows(json.escrows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setEscrowLoading(false);
    }
  }, []);

  const fetchAdminData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/super-admin-manage", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch admin settings");
      const json = await res.json();
      setAdminData(json);
    } catch (e: any) {
      setError(e.message || "Failed to fetch admin settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
    // fetch initial users and escrows for management panel
    fetchUsers();
    fetchEscrows();
  }, [fetchAdminData, fetchUsers, fetchEscrows]);

  // Fetch current user from server-side endpoint to ensure we detect
  // the signed-in user even if client-side supabase session isn't ready.
  useEffect(() => {
    let mounted = true;
    async function detectMe() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        const email = json?.user?.email ?? null;
        const role = json?.user?.role ?? null;
        const online = json?.user?.online ?? false;
        if (!mounted) return;
        setDetectedEmail(email);
        setDetectedRole(role);
        setIsOnline(!!online);
      } catch (e) {
        // ignore
      }
    }
    detectMe();
    return () => {
      mounted = false;
    };
  }, []);

  // Handler for online/offline toggle
  async function handleToggleOnline() {
    setPresenceLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/set-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_online: !isOnline }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update online status");
      setIsOnline((prev) => !prev);
      setSuccess(`You are now ${!isOnline ? "online" : "offline"}.`);
    } catch (e: any) {
      setError(e.message || "Failed to update online status");
    } finally {
      setPresenceLoading(false);
    }
  }

  useEffect(() => {
    // Priority: detected server-side user, then parent prop, then fetched adminData
    const emailToCheck = detectedEmail || currentUserEmail;

    if (emailToCheck === "ceo@kratos.ng" || detectedRole === "super_admin") {
      setIsMainAdmin(true);
      return;
    }

    if (emailToCheck && adminData?.super_admins?.length) {
      const match = adminData.super_admins.find(
        (s) => s.email === emailToCheck,
      );
      setIsMainAdmin(!!match);
    }
  }, [detectedEmail, detectedRole, currentUserEmail, adminData]);

  function formatDate(dateString: string) {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    return new Date(dateString).toLocaleString("en-US", options);
  }

  async function handleAddAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionLoading("add");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: newAdminEmail, action: "add" }),
      });

      if (!response.ok) {
        throw new Error("Failed to grant admin privileges");
      }

      setSuccess(`Admin privileges granted to ${newAdminEmail}`);
      setNewAdminEmail("");
      fetchAdminData();
      onAdminUpdate?.();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveAdmin(email: string) {
    if (
      !confirm(
        `Are you sure you want to remove admin privileges from ${email}?`,
      )
    ) {
      return;
    }

    setActionLoading(email);
    setError("");
    setSuccess("");

    try {
      // The assign-role endpoint handles add/remove via POST with an action
      const response = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, action: "remove" }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove admin");
      }

      setSuccess(`Admin privileges removed from ${email}`);
      fetchAdminData();
      onAdminUpdate?.();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteUser(userId: string, email?: string) {
    if (
      !confirm(
        `Permanently delete user ${email || userId} and all related records?`,
      )
    )
      return;
    setUserActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      setSuccess(`User ${email || userId} deleted`);
      await fetchUsers();
      await fetchAdminData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUserActionLoading(null);
    }
  }

  function handleEditTelegramId(userId: string, currentTelegramId: string | null) {
    setEditingTelegramId(userId);
    setTelegramIdValue(currentTelegramId || "");
  }

  function handleCancelTelegramEdit() {
    setEditingTelegramId(null);
    setTelegramIdValue("");
  }

  async function handleUpdateTelegramId(userId: string, email?: string) {
    setUserActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: telegramIdValue.trim() || null,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update Telegram ID");
      }
      setSuccess(`Telegram ID updated for ${email || userId}`);
      setEditingTelegramId(null);
      setTelegramIdValue("");
      await fetchUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUserActionLoading(null);
    }
  }

  async function handleDeleteEscrow(escrowId: string) {
    if (
      !confirm(
        `Delete escrow ${escrowId} and all related records? This cannot be undone.`,
      )
    )
      return;
    setEscrowActionLoading(escrowId);
    try {
      const res = await fetch(`/api/admin/escrows/${escrowId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete escrow");
      setSuccess(`Escrow ${escrowId} deleted`);
      await fetchEscrows(escrowQuery);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEscrowActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              👑 Administrator Management
            </h2>
            <p className="text-gray-600">
              Manage admin privileges for platform users
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Admins</div>
            <div className="text-2xl font-bold text-blue-600">
              {adminData?.total_count || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">❌</div>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-green-400 mr-3">✅</div>
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Add Admin Section (only for main admin) */}
      {isMainAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Add New Administrator
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary"
              disabled={!!actionLoading}
            >
              {showAddForm ? "❌ Cancel" : "➕ Add Admin"}
            </button>
          </div>
          {showAddForm && (
            <form onSubmit={handleAddAdmin} className="border-t pt-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="email"
                    placeholder="Enter email address of existing user..."
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="input"
                    required
                    disabled={!!actionLoading}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary px-6"
                  disabled={!newAdminEmail.trim() || actionLoading === "add"}
                >
                  {actionLoading === "add" ? "Adding..." : "Grant Admin"}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                ⚠️ User must already have an account on the platform to be
                granted admin privileges.
              </p>
            </form>
          )}
        </div>
      )}

      {/* Current Admins & Online/Offline Toggle */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Current Administrators
          </h3>
          {/* Online/Offline Toggle for current admin */}
          <button
            onClick={handleToggleOnline}
            className={`btn-secondary ${isOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
            disabled={presenceLoading}
            title="Toggle your online/offline status"
          >
            {presenceLoading
              ? "Updating..."
              : isOnline
                ? "🟢 Online (Click to go offline)"
                : "⚪ Offline (Click to go online)"}
          </button>
        </div>
        {adminData && (
          <div className="space-y-4">
            {/* Super Admin */}
            {adminData?.super_admins?.map((s) => (
              <div
                key={s.id}
                className="border rounded-lg p-4 bg-yellow-50 border-yellow-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">👑</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {s?.email ?? ""}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        {(s?.full_name ?? "No name set") + " • "}
                        Added: {s?.created_at ? formatDate(s.created_at) : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right"></div>
                </div>
              </div>
            ))}
            {/* Regular Admins */}
            {adminData?.admins?.map((admin) => (
              <div key={admin.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">👨‍💼</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {admin.email}
                        </h4>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          ADMIN
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {admin.full_name || "No name set"} • Added:{" "}
                        {formatDate(admin.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleRemoveAdmin(admin.email)}
                      className="btn-secondary text-red-600 hover:text-red-800 hover:bg-red-50"
                      disabled={actionLoading === admin.email}
                    >
                      {actionLoading === admin.email
                        ? "Removing..."
                        : "🗑️ Remove"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {adminData?.admins?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">👨‍💼</div>
                <p>No regular administrators found</p>
                <p className="text-sm">
                  Add administrators to help manage the platform
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Management */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            User Management
          </h3>
          <button onClick={fetchUsers} className="btn-secondary">
            Refresh
          </button>
        </div>

        {usersLoading ? (
          <div className="text-center py-6">Loading users...</div>
        ) : users && users.length > 0 ? (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.email || u.id}</div>
                    <div className="text-sm text-gray-500">
                      Role: {u.profile?.role || "no profile"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemoveAdmin(u.email || "")}
                      className="btn-secondary text-sm"
                    >
                      Toggle Admin
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      className="btn-secondary text-red-600"
                    >
                      {userActionLoading === u.id ? "Deleting..." : "🗑️ Delete"}
                    </button>
                  </div>
                </div>

                {/* Telegram ID Management */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">Telegram ID:</span>{" "}
                      {editingTelegramId === u.id ? (
                        <input
                          type="text"
                          value={telegramIdValue}
                          onChange={(e) => setTelegramIdValue(e.target.value)}
                          className="ml-2 px-2 py-1 border rounded text-sm w-48"
                          placeholder="Enter Telegram ID or leave empty to clear"
                        />
                      ) : (
                        <span className="text-gray-600">
                          {u.profile?.telegram_id || "Not set"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingTelegramId === u.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateTelegramId(u.id, u.email)}
                            disabled={userActionLoading === u.id}
                            className="btn-primary text-xs"
                          >
                            {userActionLoading === u.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={handleCancelTelegramEdit}
                            className="btn-secondary text-xs"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEditTelegramId(u.id, u.profile?.telegram_id ?? null)}
                          className="btn-secondary text-xs"
                        >
                          {u.profile?.telegram_id ? "Edit Telegram ID" : "Set Telegram ID"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">No users found</div>
        )}
      </div>

      {/* Escrow Management */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Escrow Management
          </h3>
          <div className="flex items-center gap-2">
            <input
              value={escrowQuery}
              onChange={(e) => setEscrowQuery(e.target.value)}
              placeholder="search description..."
              className="input"
            />
            <button
              onClick={() => fetchEscrows(escrowQuery)}
              className="btn-secondary"
            >
              Search
            </button>
          </div>
        </div>

        {escrowLoading ? (
          <div className="text-center py-6">Loading escrows...</div>
        ) : escrows && escrows.length > 0 ? (
          <div className="space-y-3">
            {escrows.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="font-mono font-semibold">
                    {e.code} • {e.status}
                  </div>
                  <div className="text-sm text-gray-500">
                    {e.description?.slice(0, 80)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteEscrow(e.id)}
                    className="btn-secondary text-red-600"
                  >
                    {escrowActionLoading === e.id ? "Deleting..." : "🗑️ Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">No escrows found</div>
        )}
      </div>
    </div>
  );
}

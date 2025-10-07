"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AdminSettings {
  bank_name: string;
  account_number: string;
  account_holder: string;
  service_fee: number;
  updated_at: string;
}

export default function AdminSettingsPage() {
  const [currentSettings, setCurrentSettings] = useState<AdminSettings | null>(
    null,
  );
  const [form, setForm] = useState({
    bank_name: "",
    account_number: "",
    account_holder: "",
    service_fee: 300,
  });
  const [profileBank, setProfileBank] = useState({
    bank_name: "",
    account_number: "",
    account_holder: "",
  });
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    fetchBankSettings();
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
  }, []);

  const fetchBankSettings = async () => {
    try {
      // Fetch admin settings (includes bank info and service fee)
      const response = await fetch("/api/admin/update-admin-settings", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const settings = data?.data;
        if (settings) {
          setCurrentSettings(settings);
          setForm({
            bank_name: settings.bank_name || "",
            account_number: settings.account_number || "",
            account_holder: settings.account_holder || "",
            service_fee: settings.service_fee || 300,
          });
        } else {
          setCurrentSettings(null);
          setForm({
            bank_name: "",
            account_number: "",
            account_holder: "",
            service_fee: 300,
          });
        }
        // fetch profile banking via dedicated endpoint
        const pb = await fetch("/api/profile/banking", {
          credentials: "include",
        });
        if (pb.ok) {
          const pjson = await pb.json();
          // profile endpoint may return { profile: { ... } } or profile directly
          const profile = pjson?.profile ?? pjson;
          setProfileBank({
            bank_name: profile?.bank_name || "",
            account_number: profile?.account_number || "",
            account_holder: profile?.account_holder_name || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching bank settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/update-admin-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      // Accept either { data: {...} } or { settings: {...} } or { profile: {...} } or direct row
      const payload = data ?? {};
      const respSettings =
        payload.data ?? payload.settings ?? payload.profile ?? payload;
      if (response.ok && respSettings) {
        setSuccess("Admin settings updated successfully!");
        // Update UI from POST response instead of refetching
        setCurrentSettings(respSettings);
        setForm({
          bank_name: respSettings.bank_name || "",
          account_number: respSettings.account_number || "",
          account_holder:
            respSettings.account_holder ||
            respSettings.account_holder_name ||
            "",
          service_fee: respSettings.service_fee || 300,
        });
      } else {
        setError((data && data.error) || "Failed to update settings");
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveProfileBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/update-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profileBank }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to update profile bank");
      } else {
        setSuccess("Profile bank updated");
      }
    } catch (e) {
      console.error("Save profile bank error:", e);
      setError("Failed to update profile bank");
    } finally {
      setSaving(false);
    }
  };

  const togglePresence = async () => {
    if (!user) return;
    setPresenceLoading(true);
    try {
      const res = await fetch("/api/admin/set-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_online: !(profileBank as any).is_online }),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        // refresh profile banking
        const pb = await fetch("/api/profile/banking", {
          credentials: "include",
        });
        if (pb.ok) {
          const pjson = await pb.json();
          setProfileBank({
            bank_name: pjson.profile?.bank_name || "",
            account_number: pjson.profile?.account_number || "",
            account_holder: pjson.profile?.account_holder_name || "",
          });
        }
      }
    } catch (e) {
      console.error("Toggle presence error:", e);
    } finally {
      setPresenceLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
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
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-800"
            >
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
          {user && (
            <button onClick={handleLogout} className="btn-secondary">
              🚪 Logout
            </button>
          )}
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-2xl">
        {/* Current Settings */}
        {currentSettings && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Current Bank Settings
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
              <div>
                <span className="font-medium">Bank Name:</span>{" "}
                {currentSettings.bank_name}
              </div>
              <div>
                <span className="font-medium">Account Number:</span>{" "}
                {currentSettings.account_number}
              </div>
              <div>
                <span className="font-medium">Account Holder:</span>{" "}
                {currentSettings.account_holder}
              </div>
              <div>
                <span className="font-medium">Service Fee:</span> ₦
                {currentSettings.service_fee?.toLocaleString() || "300"}
              </div>
              <div className="text-sm text-gray-500">
                Last updated:{" "}
                {currentSettings.updated_at
                  ? new Date(currentSettings.updated_at).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>
        )}

        {/* Update Form */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Update Admin Settings</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="bank_name" className="label">
                Bank Name
              </label>
              <input
                type="text"
                id="bank_name"
                name="bank_name"
                value={form.bank_name}
                onChange={handleInputChange}
                placeholder="e.g., First Bank Nigeria"
                className="input"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="account_number" className="label">
                Account Number
              </label>
              <input
                type="text"
                id="account_number"
                name="account_number"
                value={form.account_number}
                onChange={handleInputChange}
                placeholder="e.g., 1234567890"
                className="input"
                required
                disabled={saving}
                minLength={10}
                maxLength={20}
              />
            </div>

            <div>
              <label htmlFor="account_holder" className="label">
                Account Holder Name
              </label>
              <input
                type="text"
                id="account_holder"
                name="account_holder"
                value={form.account_holder}
                onChange={handleInputChange}
                placeholder="e.g., ESCROW SERVICES LTD"
                className="input"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="service_fee" className="label">
                Service Fee (₦)
              </label>
              <input
                type="number"
                id="service_fee"
                name="service_fee"
                value={form.service_fee}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    service_fee: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="e.g., 300"
                className="input"
                required
                disabled={saving}
                min="0"
                max="10000"
                step="0.01"
              />
              <p className="text-sm text-gray-600 mt-1">
                This fee will be charged for each escrow transaction
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? "Updating..." : "Update Admin Settings"}
            </button>
          </form>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <h3 className="font-semibold text-yellow-800 mb-2">
              ⚠️ Important Notes
            </h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>
                • Bank details will be shown to all buyers for payment. Ensure
                they are correct.
              </li>
              <li>
                • Service fee changes will apply to all new escrow transactions.
              </li>
              <li>• Existing escrows will keep their original fee amount.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

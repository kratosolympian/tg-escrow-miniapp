/**
 * Session-based authentication and role management
 *
 * This replaces the permanent role system with session-based roles and
 * temporary Telegram ID associations for better flexibility.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabaseClient";

export type UserRole = "buyer" | "seller" | "admin" | "super_admin";
export type SessionData = {
  role: UserRole;
  telegramId?: string;
  telegramUsername?: string;
  sessionId: string;
  createdAt: number;
};

// Session storage keys
const SESSION_ROLE_KEY = "escrow_session_role";
const SESSION_TELEGRAM_KEY = "escrow_session_telegram";
const SESSION_ID_KEY = "escrow_session_id";

// Generate a unique session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get current session data
export function getSessionData(): SessionData | null {
  try {
    if (typeof window === "undefined") return null;

    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    const role = localStorage.getItem(SESSION_ROLE_KEY) as UserRole;
    const telegramData = localStorage.getItem(SESSION_TELEGRAM_KEY);

    if (!sessionId || !role) return null;

    let telegramInfo: { id?: string; username?: string } = {};
    if (telegramData) {
      try {
        telegramInfo = JSON.parse(telegramData);
      } catch (e) {
        console.warn("Invalid telegram session data, clearing");
        localStorage.removeItem(SESSION_TELEGRAM_KEY);
      }
    }

    return {
      role,
      telegramId: telegramInfo.id,
      telegramUsername: telegramInfo.username,
      sessionId,
      createdAt: parseInt(sessionId.split("_")[1]) || Date.now(),
    };
  } catch (error) {
    console.error("Error reading session data:", error);
    return null;
  }
}

// Set session role
export function setSessionRole(role: UserRole): void {
  if (typeof window === "undefined") return;

  try {
    let sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    localStorage.setItem(SESSION_ROLE_KEY, role);
  } catch (error) {
    console.error("Error setting session role:", error);
  }
}

// Set session Telegram data
export function setSessionTelegram(telegramId: string, username?: string): void {
  if (typeof window === "undefined") return;

  try {
    const telegramData = JSON.stringify({
      id: telegramId,
      username: username || "",
    });
    localStorage.setItem(SESSION_TELEGRAM_KEY, telegramData);
  } catch (error) {
    console.error("Error setting session telegram data:", error);
  }
}

// Clear session data
export function clearSessionData(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(SESSION_ROLE_KEY);
    localStorage.removeItem(SESSION_TELEGRAM_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
  } catch (error) {
    console.error("Error clearing session data:", error);
  }
}

// Get effective role (session role takes precedence over legacy profile role)
export async function getEffectiveRole(
  supabase: SupabaseClient<Database>
): Promise<UserRole> {
  // Check session role first
  const sessionData = getSessionData();
  if (sessionData?.role) {
    return sessionData.role;
  }

  // Fallback to legacy profile role
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "buyer";

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role) {
      // Migrate legacy role to session
      setSessionRole(profile.role as UserRole);
      return profile.role as UserRole;
    }
  } catch (error) {
    console.error("Error getting effective role:", error);
  }

  // Default to buyer
  return "buyer";
}

// Get effective Telegram ID (session takes precedence)
export function getEffectiveTelegramId(): string | undefined {
  const sessionData = getSessionData();
  return sessionData?.telegramId;
}

// Initialize session for new users
export function initializeSessionForUser(role: UserRole = "buyer"): void {
  if (typeof window === "undefined") return;

  const existingSession = getSessionData();
  if (!existingSession) {
    setSessionRole(role);
  }
}

// Check if user can access a role (for admin checks)
export async function canAccessRole(
  supabase: SupabaseClient<Database>,
  requiredRole: UserRole
): Promise<boolean> {
  const effectiveRole = await getEffectiveRole(supabase);

  // Admin roles can access everything
  if (effectiveRole === "admin" || effectiveRole === "super_admin") {
    return true;
  }

  // Check specific role requirements
  if (requiredRole === "admin" || requiredRole === "super_admin") {
    return (effectiveRole as UserRole) === "admin" || (effectiveRole as UserRole) === "super_admin";
  }

  // For buyer/seller roles, any authenticated user can access
  if (requiredRole === "buyer" || requiredRole === "seller") {
    return effectiveRole === "buyer" || effectiveRole === "seller";
  }

  // Default to false for unknown roles
  return false;
}
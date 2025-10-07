/**
 * Temporary Telegram session management for server-side notifications
 * Since Telegram IDs are now session-based, we need a way to store them
 * temporarily for notification purposes.
 */

interface TelegramSession {
  telegramId: string;
  userId: string;
  username?: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory store for Telegram sessions (in production, use Redis or similar)
const telegramSessions = new Map<string, TelegramSession>();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  telegramSessions.forEach((session, key) => {
    if (session.expiresAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => telegramSessions.delete(key));
}, 60 * 60 * 1000); // Clean up every hour

export function storeTelegramSession(
  userId: string,
  telegramId: string,
  username?: string
): string {
  console.log(`[TelegramSession] Storing new session for user ${userId}: telegramId=${telegramId}, clearing existing sessions first`);
  // Clear any existing sessions for this user before creating a new one
  clearTelegramSession(userId);

  const sessionId = `telegram_${userId}_${Date.now()}`;
  const session: TelegramSession = {
    telegramId,
    userId,
    username,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT,
  };

  telegramSessions.set(sessionId, session);
  console.log(`[TelegramSession] Stored new session for user ${userId}: telegramId=${telegramId}, total sessions: ${telegramSessions.size}`);
  return sessionId;
}

export function getTelegramSession(userId: string): TelegramSession | null {
  // Find the most recent session for this user
  let latestSession: TelegramSession | null = null;
  let latestTime = 0;
  let sessionCount = 0;

  telegramSessions.forEach((session: TelegramSession) => {
    if (session.userId === userId) {
      sessionCount++;
      if (session.createdAt > latestTime) {
        latestSession = session;
        latestTime = session.createdAt;
      }
    }
  });

  console.log(`[TelegramSession] Found ${sessionCount} sessions for user ${userId}, latest created at ${latestTime}`);

  const session = latestSession as TelegramSession | null;
  if (session && session.expiresAt > Date.now()) {
    console.log(`[TelegramSession] Returning valid session: telegramId=${session.telegramId}`);
    return session;
  }

  if (session) {
    console.log(`[TelegramSession] Session expired for user ${userId}`);
  } else {
    console.log(`[TelegramSession] No session found for user ${userId}`);
  }

  return null;
}

export function clearTelegramSession(userId: string): void {
  const initialCount = telegramSessions.size;
  const keysToDelete: string[] = [];
  telegramSessions.forEach((session, key) => {
    if (session.userId === userId) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => telegramSessions.delete(key));
  console.log(`[TelegramSession] Cleared ${keysToDelete.length} sessions for user ${userId} (${initialCount} -> ${telegramSessions.size})`);
}

export function getTelegramIdForUser(userId: string): string | null {
  const session = getTelegramSession(userId);
  const telegramId = session?.telegramId || null;
  console.log(`[TelegramSession] Getting telegramId for user ${userId}: ${telegramId}`);
  return telegramId;
}
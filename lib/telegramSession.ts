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
  const sessionId = `telegram_${userId}_${Date.now()}`;
  const session: TelegramSession = {
    telegramId,
    userId,
    username,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT,
  };

  telegramSessions.set(sessionId, session);
  return sessionId;
}

export function getTelegramSession(userId: string): TelegramSession | null {
  // Find the most recent session for this user
  let latestSession: TelegramSession | null = null;
  let latestTime = 0;

  telegramSessions.forEach((session: TelegramSession) => {
    if (session.userId === userId && session.createdAt > latestTime) {
      latestSession = session;
      latestTime = session.createdAt;
    }
  });

  const session = latestSession as TelegramSession | null;
  if (session && session.expiresAt > Date.now()) {
    return session;
  }

  return null;
}

export function clearTelegramSession(userId: string): void {
  const keysToDelete: string[] = [];
  telegramSessions.forEach((session, key) => {
    if (session.userId === userId) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => telegramSessions.delete(key));
}

export function getTelegramIdForUser(userId: string): string | null {
  const session = getTelegramSession(userId);
  return session?.telegramId || null;
}
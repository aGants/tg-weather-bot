/**
 * Middleware для работы с сессиями
 */

// Простое хранилище сессий в памяти
const sessions = new Map();
const lastAccess = new Map();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // Сессия неактивного пользователя живет 30 дней
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Проверяем раз в час

// Периодически удаляем сессии неактивных пользователей, чтобы память не росла бесконечно
function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [userId, timestamp] of lastAccess) {
    if (now - timestamp > SESSION_TTL_MS) {
      sessions.delete(userId);
      lastAccess.delete(userId);
    }
  }
}

setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS).unref();

// Middleware для работы с сессиями
function sessionMiddleware() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;

    if (userId) {
      if (!sessions.has(userId)) {
        sessions.set(userId, {});
      }

      lastAccess.set(userId, Date.now());
      ctx.session = sessions.get(userId);
    }

    await next();
  };
}

module.exports = { sessionMiddleware, sessions };

/**
 * Middleware для ограничения частоты запросов (rate limiting)
 * Защищает внешние погодные API от злоупотреблений
 */

const WINDOW_MS = 10_000; // Окно в 10 секунд
const MAX_REQUESTS_PER_WINDOW = 5; // Максимум запросов на пользователя за окно
const CLEANUP_INTERVAL_MS = 60_000; // Проверяем раз в минуту

// Хранилище временных меток запросов по пользователям
const requestLog = new Map();

// Периодически удаляем записи неактивных пользователей, чтобы память не росла бесконечно
function cleanupStaleEntries() {
  const now = Date.now();

  for (const [userId, timestamps] of requestLog) {
    const fresh = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);

    if (fresh.length === 0) {
      requestLog.delete(userId);
    } else {
      requestLog.set(userId, fresh);
    }
  }
}

setInterval(cleanupStaleEntries, CLEANUP_INTERVAL_MS).unref();

function rateLimitMiddleware() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;

    if (!userId) {
      return await next();
    }

    const now = Date.now();
    const timestamps = (requestLog.get(userId) || []).filter(
      (timestamp) => now - timestamp < WINDOW_MS
    );

    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      console.log(`⚠️ Rate limit сработал для пользователя ${userId}`);
      return await ctx.reply(
        "⏳ Слишком много запросов. Подождите немного и попробуйте снова."
      );
    }

    timestamps.push(now);
    requestLog.set(userId, timestamps);

    await next();
  };
}

module.exports = { rateLimitMiddleware };

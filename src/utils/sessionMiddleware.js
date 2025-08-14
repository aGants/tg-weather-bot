/**
 * Middleware для работы с сессиями
 */

// Простое хранилище сессий в памяти
const sessions = new Map();

// Middleware для работы с сессиями
function sessionMiddleware() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;

    if (userId) {
      if (!sessions.has(userId)) {
        sessions.set(userId, {});
      }

      ctx.session = sessions.get(userId);
    }

    await next();
  };
}

module.exports = { sessionMiddleware, sessions };

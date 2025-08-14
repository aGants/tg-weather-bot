const { GrammyError, HttpError } = require("grammy");

function handleError(err) {
  const { ctx, error: e } = err;
  console.error(`Error while handling update ${ctx.update.update_id}:`);

  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);

    // Специальная обработка для rate limit ошибок
    if (e.error_code === 429) {
      const retryAfter = e.parameters?.retry_after || 60;
      console.error(
        `⚠️ Rate limit превышен! Повторите запрос через ${retryAfter} секунд`
      );

      // Отправляем сообщение пользователю о rate limit
      if (ctx?.reply) {
        ctx
          .reply(
            `⚠️ Слишком много запросов. Попробуйте через ${retryAfter} секунд.`
          )
          .catch(console.error);
      }
    }
    return;
  }

  if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
    return;
  }

  console.error("Unknown error:", e);
}

module.exports = { handleError };

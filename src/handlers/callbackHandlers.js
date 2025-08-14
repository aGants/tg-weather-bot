const { shareKeyboard } = require("../utils/keyboards");

async function handleShareCallback(ctx) {
  await Promise.all([
    ctx.reply("Поделись своими гео-данными", { reply_markup: shareKeyboard }),
    ctx.answerCallbackQuery(),
  ]);
}

async function handleManualCallback(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.waitingForCity = true;

  await Promise.all([
    ctx.reply("Введите свой город в формате: Москва, Санкт-Петербург, и т.д."),
    ctx.answerCallbackQuery(),
  ]);
}

module.exports = {
  handleShareCallback,
  handleManualCallback,
};

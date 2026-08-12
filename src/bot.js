require("dotenv").config();
const { Bot } = require("grammy");
const { hydrate } = require("@grammyjs/hydrate");

const { ACTIONS, COMMANDS_MENU } = require("./config/constants");
const { sessionMiddleware } = require("./utils/sessionMiddleware");
const { rateLimitMiddleware } = require("./utils/rateLimitMiddleware");
const {
  handleStart,
  handleShare,
  handleManual,
  handleWhatToWear,
} = require("./handlers/commandHandlers");
const {
  handleShareCallback,
  handleManualCallback,
} = require("./handlers/callbackHandlers");
const { handleLocation, handleText } = require("./handlers/eventHandlers");
const { handleError } = require("./handlers/errorHandler");

const bot = new Bot(process.env.BOT_API_KEY);
bot.use(hydrate());
bot.use(sessionMiddleware());
bot.use(rateLimitMiddleware());

// Функция для установки команд с retry логикой
async function setupCommands(retryAfter = 60) {
  try {
    await bot.api.setMyCommands(COMMANDS_MENU);
    console.log("✅ Команды бота успешно установлены");
  } catch (error) {
    if (error.error_code === 429) {
      const retryDelay = error.parameters?.retry_after || retryAfter;
      console.log(
        `⚠️ Rate limit превышен. Повторная попытка через ${retryDelay} секунд`
      );

      setTimeout(() => setupCommands(retryDelay), retryDelay * 1000);
    } else {
      console.error("❌ Ошибка при установке команд:", error.message);
    }
  }
}

// Устанавливаем команды
setupCommands();

// Регистрируем обработчики
const { start, share, manual, what } = ACTIONS;

bot.command(start, handleStart);
bot.command(share, handleShare);
bot.command(manual, handleManual);
bot.command(what, handleWhatToWear);

bot.callbackQuery(share, handleShareCallback);
bot.callbackQuery(manual, handleManualCallback);

bot.on(":location", handleLocation);
bot.on(":text", handleText);

bot.catch(handleError);

module.exports = bot;

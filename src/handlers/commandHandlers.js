const { ACTIONS } = require("../config/constants");
const {
  getWeatherByCity,
  getWeatherByCoords,
} = require("../services/weatherService");
const { menuGeoChoose, shareKeyboard } = require("../utils/keyboards");

async function handleStart(ctx) {
  console.log("📊 /start", ctx.from?.id);
  const { session } = ctx;
  const hasLastCity = session?.lastCity;

  const message = [
    "Привет! Я бот, который подскажет, как одеться по погоде! 🌤\n\n",
    hasLastCity
      ? `📍 Ваш город: ${session.lastCity}\n\n• Получить рекомендации по одежде: /what_to_wear\n`
      : "Для начала мне нужно узнать твой город.\n\n",
    "Выберите способ определения города:",
  ].join("");

  await ctx.reply(message, { reply_markup: menuGeoChoose });
}

async function handleShare(ctx) {
  console.log("📊 /share_location", ctx.from?.id);
  await ctx.reply("Поделись своими гео-данными", {
    reply_markup: shareKeyboard,
  });
}

async function handleManual(ctx) {
  console.log("📊 /manual_city", ctx.from?.id);
  await ctx.reply(
    "Введите свой город в формате: Москва, Санкт-Петербург, и т.д."
  );
  ctx.session = ctx.session || {};
  ctx.session.waitingForCity = true;
}

// Обработчик команды /what_to_wear
// Использует сохраненные координаты для получения консистентных данных о погоде
async function handleWhatToWear(ctx) {
  console.log("📊 /what_to_wear", ctx.from?.id);
  const { session } = ctx;

  if (!session?.lastCity) {
    return await ctx.reply(
      "❌ Сначала выберите город!\n\n" +
        "Чтобы получить рекомендации по одежде, сначала поделитесь геолокацией или введите название города.\n\n" +
        "Используйте команду /start для выбора способа определения города."
    );
  }

  try {
    await ctx.replyWithChatAction("typing");

    // Приоритет: используем сохраненные координаты, fallback - геокодинг города
    const weather = session.lastCoords
      ? await getWeatherByCoords(
          session.lastCoords.lat,
          session.lastCoords.lon,
          session.lastCity
        )
      : await getWeatherByCity(session.lastCity);

    await ctx.reply(weather);
  } catch (error) {
    console.error("❌ Ошибка при получении погоды:", error);
    await ctx.reply(
      `❌ Не удалось получить погоду для города ${session.lastCity}.\n\n` +
        "Возможно, название города изменилось. Попробуйте выбрать город заново.\n\n"
    );
  }
}

module.exports = {
  handleStart,
  handleShare,
  handleManual,
  handleWhatToWear,
};

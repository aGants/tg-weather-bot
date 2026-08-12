/**
 * Обработчики событий (геолокация, текстовые сообщения)
 *
 * Логика работы:
 * 1. При геолокации: сохраняем город и точные координаты
 * 2. При ручном вводе города: получаем координаты через геокодинг и сохраняем
 * 3. При команде /what_to_wear: используем сохраненные координаты для получения погоды
 *    Это обеспечивает консистентность данных между вызовами
 */
const {
  getCityByCoords,
  getWeatherByCoords,
  getWeatherByCity,
  getCityCoords,
} = require("../services/weatherService");
const { sanitizeCityName } = require("../utils/textSanitizer");

// Обработчик геолокации
async function handleLocation(ctx) {
  try {
    const { latitude, longitude } = ctx.message.location;
    // Логируем координаты с пониженной точностью (~11 км), чтобы не хранить
    // точное местоположение пользователя в логах
    console.log(
      `📍 Получена геолокация: ~${latitude.toFixed(1)}, ~${longitude.toFixed(1)}`
    );

    await ctx.replyWithChatAction("typing");

    // Получаем название города по координатам
    const cityName = await getCityByCoords(latitude, longitude);

    if (!cityName) {
      return await ctx.reply(
        "❌ Не удалось определить город по вашей геолокации. Попробуйте ввести название города вручную.",
        { reply_markup: { remove_keyboard: true } }
      );
    }

    // Сохраняем город и координаты в сессии
    ctx.session = ctx.session || {};
    ctx.session.lastCity = cityName;
    ctx.session.lastCoords = { lat: latitude, lon: longitude };

    console.log(`✅ Город определен: ${cityName}, координаты сохранены`);

    // Сначала отправляем сообщение о городе
    await ctx.reply(
      `📍 Определил ваш город: ${cityName}\n\nТеперь я могу подсказать тебе, что можно надеть!`,
      {
        reply_markup: { remove_keyboard: true },
      }
    );

    // Затем получаем и отправляем прогноз погоды
    await ctx.replyWithChatAction("typing");
    const weatherInfo = await getWeatherByCoords(latitude, longitude, cityName);
    await ctx.reply(weatherInfo);
  } catch (error) {
    console.error("❌ Ошибка при обработке геолокации:", error);
    await ctx.reply(
      "❌ Произошла ошибка при обработке геолокации. Попробуйте ввести название города вручную.",
      { reply_markup: { remove_keyboard: true } }
    );
  }
}

// Обработчик текстовых сообщений
async function handleText(ctx) {
  const { text } = ctx.message;
  const { session } = ctx;

  console.log("💬 Получено текстовое сообщение от пользователя:", ctx.from?.id);

  // Если ожидаем ввод города
  if (session?.waitingForCity) {
    session.waitingForCity = false;

    const city = sanitizeCityName(text);

    if (!city) {
      await ctx.reply(
        "❌ Название города не может быть пустым. Попробуйте еще раз через /manual_city."
      );
      return;
    }

    console.log("✅ Обрабатываем ввод города:", city);

    try {
      await ctx.replyWithChatAction("typing");

      // Получаем погоду и координаты города
      const [weather, cityCoords] = await Promise.all([
        getWeatherByCity(city),
        getCityCoords(city),
      ]);

      // Сохраняем данные в сессии
      session.lastCity = city;
      if (cityCoords) {
        session.lastCoords = { lat: cityCoords.lat, lon: cityCoords.lon };
        console.log("💾 Город и координаты сохранены:", city);
      } else {
        console.log("💾 Город сохранен, координаты не получены:", city);
      }

      // Сначала отправляем сообщение о сохранении города
      await ctx.reply(
        `💾 Город "${city}" сохранен!\n\nТеперь вы можете использовать команду /what_to_wear для получения рекомендаций по одежде в любое время.`
      );

      // Затем отправляем прогноз погоды
      await ctx.reply(weather);
    } catch (error) {
      console.error("❌ Ошибка при получении погоды для города:", city, error);
      await ctx.reply(
        `❌ Извините, не удалось получить погоду для города "${city}".\n\n` +
          "Попробуйте другой город или проверьте правильность написания."
      );
    }
    return;
  }

  // Если это не ввод города, игнорируем
  console.log("ℹ️ Игнорируем сообщение, не связанное с вводом города");
}

module.exports = {
  handleLocation,
  handleText,
};

/**
 * Сервис для работы с погодными API
 *
 * Основные функции:
 * - Получение погоды по координатам и названию города
 * - Геокодинг (координаты ↔ название города)
 * - Форматирование ответов о погоде
 *
 * Логика определения погоды и рекомендаций вынесена в weatherLogic.js
 */
// User-Agent обязателен для Nominatim (https://operations.osmfoundation.org/policies/nominatim/)
// и вежлив по отношению к любому внешнему API
const REQUEST_HEADERS = {
  "User-Agent": "tg-weather-bot/1.0 (https://github.com/aGants/tg-weather-bot)",
};
const REQUEST_TIMEOUT_MS = 10000;

// Функция для retry API запросов
async function fetchWithRetry(url, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 429) {
        // Rate limit - ждем 1 секунду и пробуем снова
        console.log(
          `⚠️ Rate limit, попытка ${attempt}/${maxRetries}, ждем 1 секунду`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      // Простая задержка 1 секунда перед повторной попыткой
      console.log(
        `⚠️ Ошибка API, попытка ${attempt}/${maxRetries}, ждем 1 секунду`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Достигнуто только если все попытки исчерпаны из-за 429
  throw lastError || new Error("Не удалось получить ответ от API");
}

// Импорт функций логики погоды
const {
  getWeatherDescription,
  getClothingAdvice,
  getUVAdvice,
  formatWindInfo,
  getAirQualityLevel,
  analyzeWeatherChanges,
} = require("./weatherLogic");

const { sanitizeCityName } = require("../utils/textSanitizer");

// Константы для качества воздуха
const AIR_QUALITY_THRESHOLDS = {
  SHOW_WARNING: 40, // Показывать предупреждение если AQI > 40
  HIGH_WARNING: 80, // Высокое предупреждение если AQI > 80
  DANGER: 100, // Опасность если AQI > 100
  PM10_WARNING: 50, // Предупреждение по PM10 если > 50
  PM25_WARNING: 25, // Предупреждение по PM2.5 если > 25
};

// Функция для получения названия города по координатам
async function getCityByCoords(lat, lon) {
  try {
    const response = await fetchWithRetry(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=ru,en`
    );
    const data = await response.json();

    if (data.error) {
      return null;
    }

    // Ищем город в порядке приоритета
    const { address } = data;
    return sanitizeCityName(
      address.city ||
        address.town ||
        address.village ||
        address.county ||
        address.state ||
        address.country ||
        null
    );
  } catch (error) {
    console.error("Error getting city name:", error);
    return null;
  }
}

// Функция для получения координат города по названию
async function getCityCoords(city) {
  try {
    const response = await fetchWithRetry(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1&language=ru&format=json`
    );
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const { latitude, longitude, name } = data.results[0];
    return { lat: latitude, lon: longitude, name: sanitizeCityName(name) };
  } catch (error) {
    console.error("Error getting city coordinates:", error);
    return null;
  }
}

// Универсальная функция для получения погоды (объединяет getWeatherByCoords и getWeatherByCity)
async function getWeather(lat, lon, cityName = null) {
  try {
    const response = await fetchWithRetry(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,uv_index&hourly=temperature_2m,wind_speed_10m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    const data = await response.json();

    if (!data.current) {
      throw new Error("Не удалось получить данные о погоде");
    }

    return await formatWeatherResponse(data, lat, lon, cityName);
  } catch (error) {
    console.error("Error fetching weather:", error);
    throw error;
  }
}

// Функция для получения погоды по координатам
async function getWeatherByCoords(lat, lon, cityName = null) {
  return getWeather(lat, lon, cityName);
}

// Функция для получения погоды по названию города
async function getWeatherByCity(city) {
  try {
    // Получаем координаты города
    const cityCoords = await getCityCoords(city);

    if (!cityCoords) {
      return "❌ Город не найден. Проверьте название города.";
    }

    // Получаем погоду по координатам
    return await getWeather(cityCoords.lat, cityCoords.lon, cityCoords.name);
  } catch (error) {
    console.error("Error fetching weather:", error);
    throw error;
  }
}

// Функция для форматирования ответа о погоде
async function formatWeatherResponse(data, lat, lon, cityName = null) {
  const current = data.current;
  const temp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const humidity = current.relative_humidity_2m;
  const windSpeed = current.wind_speed_10m;
  const weatherCode = current.weather_code;
  const uvIndex = current.uv_index;

  // Получаем название города из координат, если не передано
  if (!cityName) {
    cityName = `координаты ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }

  const weatherDescription = getWeatherDescription(weatherCode);
  const clothingAdvice = getClothingAdvice(temp, weatherDescription);
  const uvAdvice = getUVAdvice(uvIndex);
  const windInfo = formatWindInfo(windSpeed);

  // Получаем качество воздуха и предупреждения параллельно
  const [airQualityInfo, warnings] = await Promise.all([
    getAirQualityInfo(lat, lon),
    analyzeWeatherChanges(
      temp,
      windSpeed,
      data.hourly,
      data.daily,
      weatherCode
    ),
  ]);

  // Формируем ответ с помощью массива и join для лучшей производительности
  const responseParts = [
    `🌤 Погода в ${cityName} сейчас\n\n`,
    `🌡 Температура: ${temp}°C\n`,
    `✋ Ощущается как: ${feelsLike}°C\n`,
    `💧 Влажность: ${humidity}%\n`,
    `💨 Ветер: ${windInfo}\n`,
    `☁️ ${weatherDescription}\n\n`,
    `${uvAdvice.icon} УФ-индекс: ${uvIndex} (${uvAdvice.level})\n`,
    `🛡️ ${uvAdvice.spf}\n\n`,
    `👕 ${clothingAdvice}\n\n`,
  ];

  // Добавляем предупреждения, если есть изменения
  if (warnings.length > 0) {
    responseParts.push(...warnings.map((warning) => `${warning}\n`));
    responseParts.push("\n");
  }

  responseParts.push(airQualityInfo);

  return responseParts.join("");
}

// Функция для анализа качества воздуха
async function getAirQualityInfo(lat, lon) {
  try {
    const response = await fetchWithRetry(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=european_aqi,pm10,pm2_5&current=european_aqi,pm10,pm2_5`
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();

    if (!data.current?.european_aqi) {
      return "";
    }

    const { european_aqi: aqi, pm10, pm2_5 } = data.current;

    // Показываем информацию только если качество воздуха плохое
    if (aqi <= AIR_QUALITY_THRESHOLDS.SHOW_WARNING) {
      return "";
    }

    const airQualityLevel = getAirQualityLevel(aqi);

    // Определяем уровень предупреждения
    const warning =
      aqi > AIR_QUALITY_THRESHOLDS.DANGER
        ? "🚨 Опасно! Качество воздуха очень плохое.\n \n"
        : aqi > AIR_QUALITY_THRESHOLDS.HIGH_WARNING
        ? "⚠️ Внимание! Качество воздуха плохое.\n"
        : "";

    // Собираем детали по загрязнителям
    const details = [];
    if (pm10 && pm10 > AIR_QUALITY_THRESHOLDS.PM10_WARNING) {
      details.push(`PM10: ${Math.round(pm10)} µg/m³`);
    }
    if (pm2_5 && pm2_5 > AIR_QUALITY_THRESHOLDS.PM25_WARNING) {
      details.push(`PM2.5: ${Math.round(pm2_5)} µg/m³`);
    }

    const detailsText = details.length > 0 ? `📊 ${details.join(" ")}\n` : "";

    return `${warning}${airQualityLevel.icon} Качество воздуха: ${aqi} (${airQualityLevel.description})\n${detailsText}💡 Рекомендации: ${airQualityLevel.advice}`;
  } catch (error) {
    console.error("Error fetching air quality:", error);
    return "";
  }
}

module.exports = {
  getCityByCoords,
  getCityCoords,
  getWeatherByCoords,
  getWeatherByCity,
  formatWeatherResponse,
};

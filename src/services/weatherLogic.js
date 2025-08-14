// Импорт констант
const {
  WEATHER_CODES,
  CLOTHING_ADVICE_MAP,
  WEATHER_EXTRA_ADVICE,
  WEATHER_TYPES, // Новый импорт для быстрой проверки
  UV_LEVELS,
  WIND_LEVELS,
  WIND_LEVEL_NAMES,
  AIR_QUALITY_LEVELS,
  WEATHER_ANALYSIS,
  TIME_DESCRIPTIONS,
  WIND_TIME_DESCRIPTIONS,
  RAIN_WEATHER_CODES,
} = require("./constants");

// Импорт утилит мемоизации
const { memoizePrimitive } = require("../utils/memoization");

// Функция валидации входных данных
function validateInputs(
  currentTemp,
  currentWindSpeed,
  hourlyData,
  dailyData,
  currentWeatherCode
) {
  if (typeof currentTemp !== "number" || isNaN(currentTemp)) {
    throw new Error("Invalid temperature value: must be a number");
  }

  if (
    typeof currentWindSpeed !== "number" ||
    isNaN(currentWindSpeed) ||
    currentWindSpeed < 0
  ) {
    throw new Error("Invalid wind speed: must be a non-negative number");
  }

  if (
    currentWeatherCode !== null &&
    (typeof currentWeatherCode !== "number" || currentWeatherCode < 0)
  ) {
    throw new Error(
      "Invalid weather code: must be null or a non-negative number"
    );
  }

  // Проверяем структуру данных
  if (hourlyData && typeof hourlyData !== "object") {
    throw new Error("Invalid hourly data: must be an object or null");
  }

  if (dailyData && typeof dailyData !== "object") {
    throw new Error("Invalid daily data: must be an object or null");
  }
}

// Функция для получения описания погоды по коду WMO (мемоизирована)
const getWeatherDescription = memoizePrimitive(function getWeatherDescription(
  code
) {
  return WEATHER_CODES.get(code) || "Неизвестно";
},
50); // Кэш на 50 элементов

// Функция для рекомендаций по одежде
function getClothingAdvice(temp, description) {
  // Находим подходящий температурный диапазон
  let baseAdvice = "";
  for (const [threshold, advice] of CLOTHING_ADVICE_MAP) {
    if (temp >= threshold) {
      baseAdvice = advice;
      break;
    }
  }

  // Добавляем рекомендации по погоде (оптимизировано с Set)
  let extraAdvice = "";
  if (WEATHER_TYPES.has(description.toLowerCase())) {
    extraAdvice = WEATHER_EXTRA_ADVICE.get(description.toLowerCase()) || "";
  }

  return baseAdvice + extraAdvice;
}

// Функция для получения рекомендаций по УФ-индексу и SPF (мемоизирована)
const getUVAdvice = memoizePrimitive(function getUVAdvice(uvIndex) {
  for (const [threshold, advice] of UV_LEVELS) {
    if (uvIndex <= threshold) {
      return advice;
    }
  }
}, 20); // Кэш на 20 элементов

// Функция для форматирования информации о ветре (мемоизирована)
const formatWindInfo = memoizePrimitive(function formatWindInfo(windSpeedKmh) {
  const windSpeed = Math.round(windSpeedKmh);

  for (const [threshold, info] of WIND_LEVELS) {
    if (windSpeed < threshold) {
      return `${info.icon} ${windSpeed} км/ч (${info.description})`;
    }
  }
}, 30); // Кэш на 30 элементов

// Функция для определения уровня качества воздуха (мемоизирована)
const getAirQualityLevel = memoizePrimitive(function getAirQualityLevel(aqi) {
  for (const [threshold, level] of AIR_QUALITY_LEVELS) {
    if (aqi <= threshold) {
      return level;
    }
  }
}, 20); // Кэш на 20 элементов

// Функция для получения описания времени (мемоизирована)
const getTimeDescription = memoizePrimitive(function getTimeDescription(
  hoursDiff,
  timeMap = TIME_DESCRIPTIONS
) {
  for (const [threshold, description] of timeMap) {
    if (hoursDiff < threshold) {
      return description;
    }
  }
  return timeMap.get(Infinity) || "к вечеру";
},
15); // Кэш на 15 элементов

// Подфункция для анализа дождя
function analyzeRainChanges(currentWeatherCode, hourlyData) {
  const warnings = [];

  if (!hourlyData?.precipitation_probability || !hourlyData?.time) {
    return warnings;
  }

  // Проверяем, не идет ли уже дождь
  const isCurrentlyRaining =
    currentWeatherCode && RAIN_WEATHER_CODES.has(currentWeatherCode);

  if (!isCurrentlyRaining) {
    // Берем данные только за ближайшие часы
    const relevantHours = hourlyData.precipitation_probability.slice(
      0,
      WEATHER_ANALYSIS.HOURS_TO_ANALYZE
    );
    const relevantTimes = hourlyData.time.slice(
      0,
      WEATHER_ANALYSIS.HOURS_TO_ANALYZE
    );
    const now = new Date();

    // Ищем часы с высокой вероятностью дождя
    const rainHours = relevantHours
      .map((probability, index) => {
        if (probability > WEATHER_ANALYSIS.RAIN_THRESHOLD) {
          const time = new Date(relevantTimes[index]);
          const timeDiff = time - now;
          const hoursDiff = Math.floor(timeDiff / WEATHER_ANALYSIS.MS_PER_HOUR);

          return hoursDiff >= 0 ? { hoursDiff, probability } : null;
        }
        return null;
      })
      .filter(Boolean); // Убираем null значения

    if (rainHours.length > 0) {
      // Сортируем по времени (ближайший дождь первым)
      rainHours.sort((a, b) => a.hoursDiff - b.hoursDiff);
      const nextRain = rainHours[0];

      const timeDescription = getTimeDescription(nextRain.hoursDiff);
      warnings.push(
        `☔ ${timeDescription} может быть дождь (${nextRain.probability}%)`
      );
    }
  }

  return warnings;
}

// Подфункция для анализа изменений температуры
function analyzeTemperatureChanges(currentTemp, dailyData) {
  const warnings = [];

  if (!dailyData?.temperature_2m_max || !dailyData?.temperature_2m_min) {
    return warnings;
  }

  const tempMax = Math.max(...dailyData.temperature_2m_max);
  const tempMin = Math.min(...dailyData.temperature_2m_min);

  // Проверяем, будет ли значительное изменение относительно текущей температуры
  if (tempMin < currentTemp - WEATHER_ANALYSIS.TEMP_CHANGE_THRESHOLD) {
    warnings.push(`⚠️ К вечеру может быть ${Math.round(tempMin)}°C`);
  } else if (tempMax > currentTemp + WEATHER_ANALYSIS.TEMP_CHANGE_THRESHOLD) {
    warnings.push(`⚠️ К вечеру может быть ${Math.round(tempMax)}°C`);
  }

  return warnings;
}

// Подфункция для анализа изменений ветра
function analyzeWindChanges(currentWindSpeed, hourlyData) {
  const warnings = [];

  if (!hourlyData?.wind_speed_10m || !hourlyData?.time) {
    return warnings;
  }

  // Берем данные только за ближайшие часы
  const relevantWindData = hourlyData.wind_speed_10m.slice(
    0,
    WEATHER_ANALYSIS.WIND_HOURS_TO_ANALYZE
  );
  const relevantTimes = hourlyData.time.slice(
    0,
    WEATHER_ANALYSIS.WIND_HOURS_TO_ANALYZE
  );
  const maxWindSpeed = Math.max(...relevantWindData);
  const currentWindLevel = getWindLevel(currentWindSpeed);
  const maxWindLevel = getWindLevel(maxWindSpeed);

  if (maxWindLevel !== currentWindLevel) {
    const windChange =
      maxWindLevel > currentWindLevel ? "усилиться" : "ослабеть";

    // Определяем время изменения ветра
    const now = new Date();
    const windChangeIndex = relevantWindData.findIndex(
      (speed) => getWindLevel(speed) !== currentWindLevel
    );

    if (windChangeIndex !== -1) {
      const windChangeTime = new Date(relevantTimes[windChangeIndex]);
      const timeDiff = windChangeTime - now;
      const hoursDiff = Math.floor(timeDiff / WEATHER_ANALYSIS.MS_PER_HOUR);

      const timeDescription = getTimeDescription(
        hoursDiff,
        WIND_TIME_DESCRIPTIONS
      );
      warnings.push(
        `💨 Ветер может ${windChange} до ${getWindLevelName(
          maxWindLevel
        )} ${timeDescription}`
      );
    }
  }

  return warnings;
}

// Основная функция для анализа изменений погоды
function analyzeWeatherChanges(
  currentTemp,
  currentWindSpeed,
  hourlyData,
  dailyData,
  currentWeatherCode = null
) {
  try {
    // Валидация входных данных
    validateInputs(
      currentTemp,
      currentWindSpeed,
      hourlyData,
      dailyData,
      currentWeatherCode
    );

    // Анализируем каждый тип изменений отдельно
    const rainWarnings = analyzeRainChanges(currentWeatherCode, hourlyData);
    const tempWarnings = analyzeTemperatureChanges(currentTemp, dailyData);
    const windWarnings = analyzeWindChanges(currentWindSpeed, hourlyData);

    // Объединяем все предупреждения
    return [...rainWarnings, ...tempWarnings, ...windWarnings];
  } catch (error) {
    console.error("❌ Ошибка в analyzeWeatherChanges:", error.message);
    return []; // Возвращаем пустой массив при ошибке
  }
}

// Функция для определения уровня ветра (мемоизирована)
const getWindLevel = memoizePrimitive(function getWindLevel(windSpeed) {
  if (windSpeed < 19) return 1;
  if (windSpeed < 38) return 2;
  if (windSpeed < 60) return 3;
  if (windSpeed < 117) return 4;
  return 5;
}, 25); // Кэш на 25 элементов

// Функция для получения названия уровня ветра (мемоизирована)
const getWindLevelName = memoizePrimitive(function getWindLevelName(level) {
  return WIND_LEVEL_NAMES.get(level) || "слабого";
}, 10); // Кэш на 10 элементов

module.exports = {
  getWeatherDescription,
  getClothingAdvice,
  getUVAdvice,
  formatWindInfo,
  getAirQualityLevel,
  analyzeWeatherChanges,
  // Экспортируем подфункции для тестирования
  analyzeRainChanges,
  analyzeTemperatureChanges,
  analyzeWindChanges,
};

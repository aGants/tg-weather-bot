/**
 * Утилита для мемоизации функций
 * Улучшает производительность для часто вызываемых функций с одинаковыми параметрами
 */

// Простая мемоизация с ограничением размера кэша
function memoize(fn, maxSize = 100) {
  const cache = new Map();

  return function (...args) {
    // Создаем ключ из аргументов
    const key = JSON.stringify(args);

    // Проверяем кэш
    if (cache.has(key)) {
      return cache.get(key);
    }

    // Вычисляем результат
    const result = fn.apply(this, args);

    // Добавляем в кэш
    cache.set(key, result);

    // Ограничиваем размер кэша
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}

// Мемоизация для функций с примитивными параметрами
function memoizePrimitive(fn, maxSize = 100) {
  const cache = new Map();

  return function (...args) {
    // Проверяем, что все аргументы примитивы
    const hasPrimitives = args.every(
      (arg) =>
        arg === null ||
        typeof arg === "boolean" ||
        typeof arg === "number" ||
        typeof arg === "string"
    );

    if (!hasPrimitives) {
      // Если есть сложные объекты, вызываем функцию без кэширования
      return fn.apply(this, args);
    }

    // Создаем ключ из примитивных аргументов
    const key = args.join("|");

    // Проверяем кэш
    if (cache.has(key)) {
      return cache.get(key);
    }

    // Вычисляем результат
    const result = fn.apply(this, args);

    // Добавляем в кэш
    cache.set(key, result);

    // Ограничиваем размер кэша
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}

// Мемоизация с TTL (Time To Live)
function memoizeWithTTL(fn, ttlMs = 60000, maxSize = 100) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);
    const now = Date.now();

    // Проверяем кэш и TTL
    if (cache.has(key)) {
      const { result, timestamp } = cache.get(key);
      if (now - timestamp < ttlMs) {
        return result;
      }
      // Удаляем устаревший результат
      cache.delete(key);
    }

    // Вычисляем результат
    const result = fn.apply(this, args);

    // Добавляем в кэш с временной меткой
    cache.set(key, { result, timestamp: now });

    // Ограничиваем размер кэша
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}

// Очистка кэша
function clearCache(memoizedFn) {
  if (memoizedFn.cache) {
    memoizedFn.cache.clear();
  }
}

// Получение статистики кэша
function getCacheStats(memoizedFn) {
  if (memoizedFn.cache) {
    return {
      size: memoizedFn.cache.size,
      maxSize: memoizedFn.maxSize || "unknown",
    };
  }
  return null;
}

module.exports = {
  memoize,
  memoizePrimitive,
  memoizeWithTTL,
  clearCache,
  getCacheStats,
};

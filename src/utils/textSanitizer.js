/**
 * Санитизация текста, полученного из внешних источников (геокодинг, пользовательский ввод)
 * перед сохранением в сессию и показом пользователю
 */

const MAX_CITY_NAME_LENGTH = 100;

// Диапазоны code point'ов, которые вырезаем: C0-контролы и DEL, zero-width
// символы (space/joiner/non-joiner, LRM/RLM), Unicode bidi-override
// (LRE/RLE/PDF/LRO/RLO — можно визуально подменить текст, например U+202E)
// и word joiner / прочие invisible-форматтеры.
const UNSAFE_CODE_POINT_RANGES = [
  [0x0000, 0x001f],
  [0x007f, 0x007f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x206f],
];

function isUnsafeCodePoint(codePoint) {
  return UNSAFE_CODE_POINT_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end
  );
}

function sanitizeCityName(name) {
  if (!name) {
    return name;
  }

  const cleaned = Array.from(name)
    .filter((char) => !isUnsafeCodePoint(char.codePointAt(0)))
    .join("");

  return cleaned.trim().slice(0, MAX_CITY_NAME_LENGTH);
}

module.exports = { sanitizeCityName, MAX_CITY_NAME_LENGTH };

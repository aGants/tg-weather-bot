const { InlineKeyboard, Keyboard } = require("grammy");
const { ACTIONS } = require("../config/constants");

// Главное меню выбора способа определения города
const menuGeoChoose = new InlineKeyboard()
  .text("Поделиться своей гео-локацией", ACTIONS.share)
  .text("Ввести гео-локацию вручную", ACTIONS.manual);

// Клавиатура для запроса геолокации
const shareKeyboard = new Keyboard()
  .requestLocation("Поделиться своей гео-локацией!")
  .resized()
  .oneTime();

module.exports = {
  menuGeoChoose,
  shareKeyboard,
};

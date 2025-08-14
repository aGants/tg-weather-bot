const ACTIONS = {
  start: "start", // /start
  what: "what_to_wear", // /what_to_wear
  share: "share_location", // /share_location + кнопка
  manual: "manual_city", // /manual_city + кнопка
};

const COMMANDS_MENU = [
  {
    command: ACTIONS.start,
    description: "Запуск бота",
  },
  {
    command: ACTIONS.share,
    description: "Поделиться геолокацией",
  },
  {
    command: ACTIONS.manual,
    description: "Ввести город вручную",
  },
  {
    command: ACTIONS.what,
    description: "Как одеться?",
  },
];

module.exports = {
  ACTIONS,
  COMMANDS_MENU,
};

const http = require("http");
const { webhookCallback } = require("grammy");
const bot = require("./bot");

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WEBHOOK_PATH = "/telegram/webhook";

async function startWebhook() {
  if (!WEBHOOK_SECRET) {
    console.warn(
      "⚠️ WEBHOOK_SECRET не задан — вебхук будет принимать запросы без проверки подлинности. Задайте WEBHOOK_SECRET в переменных окружения."
    );
  }

  await bot.api.setWebhook(`${WEBHOOK_URL}${WEBHOOK_PATH}`, {
    secret_token: WEBHOOK_SECRET,
  });

  const handleUpdate = webhookCallback(bot, "http", {
    secretToken: WEBHOOK_SECRET,
  });

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === WEBHOOK_PATH) {
      handleUpdate(req, res).catch((error) => {
        console.error("❌ Ошибка обработки вебхука:", error);
        res.writeHead(500).end();
      });
      return;
    }
    res.writeHead(200).end("OK");
  });

  server.listen(PORT, () => {
    console.log(`✅ Webhook-сервер запущен на порту ${PORT}`);
  });
}

async function startPolling() {
  await bot.api.deleteWebhook();
  bot.start();
}

if (WEBHOOK_URL) {
  startWebhook();
} else {
  startPolling();
}

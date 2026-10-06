<div align="center">

# 🌤️ TG Weather Bot

**A Telegram bot that looks at the weather and tells you what to wear.**

</div>

Send the bot your location or a city name, and it replies with the current weather plus plain-language clothing advice. Unlike a regular forecast app, it also looks a few hours ahead and warns you if rain is coming, the temperature is about to swing, or the wind is picking up, so you dress for the whole day, not just the next five minutes.

- **No weather API key needed.** All weather, geocoding and air-quality data comes from free [Open-Meteo](https://open-meteo.com) and [OpenStreetMap Nominatim](https://nominatim.org) APIs. The only secret you need is a Telegram bot token.
- **Forward-looking warnings.** Rain with >50% probability in the next 12 hours, temperature changes of more than 10°C, and wind level changes in the next 6 hours.
- **More than temperature.** "Feels like", humidity, wind level, UV index with sunscreen advice, and air quality (European AQI, PM10, PM2.5) when it's worth worrying about.
- **Remembers your city.** Share your location once, then just send `/what_to_wear` every morning.
- **Runs anywhere.** Long polling for local development, webhook mode for production (works out of the box on [Render](https://render.com)).

> [!NOTE]
> The bot talks to users in **Russian**.

### Example reply

```text
🌤 Погода в Москва сейчас

🌡 Температура: 12°C
✋ Ощущается как: 10°C
💧 Влажность: 71%
💨 Ветер: 💨 21 км/ч (Умеренный)
☁️ Переменная облачность

☀️ УФ-индекс: 3 (Умеренный)
🛡️ Используйте солнцезащитный крем

👕 Прохладно! Наденьте теплую одежду: свитер, куртку, джинсы. Не забудьте шапку и перчатки.

☔ к вечеру может быть дождь (70%)
```

<sub>Illustrative output: the layout follows the bot's real message template, the numbers are made up.</sub>

---

## Commands

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `/start`         | Main menu: choose how to set your city                  |
| `/share_location`| Share your GPS location                                 |
| `/manual_city`   | Type a city name instead                                |
| `/what_to_wear`  | Get weather and clothing advice for your saved city     |

---

## Getting started

**Requirements:** Node.js 18+ (the bot uses the built-in `fetch`) and a Telegram account.

1. **Create a bot** with [@BotFather](https://t.me/BotFather) (`/newbot`) and copy the token it gives you.

2. **Clone and install:**

   ```bash
   git clone https://github.com/aGants/tg-weather-bot.git
   cd tg-weather-bot
   npm install
   ```

3. **Add your token:**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and replace `your_telegram_bot_token` with the token from step 1.

4. **Run the bot:**

   ```bash
   npm start
   ```

   Or with auto-reload during development:

   ```bash
   npm run dev
   ```

5. **Open your bot in Telegram** and send `/start`.

Without `WEBHOOK_URL` the bot uses long polling, so it works on your laptop with no public URL or open ports.

---

## Configuration

All settings are environment variables (loaded from `.env` via `dotenv`):

| Variable         | Required | Description |
| ---------------- | -------- | ----------- |
| `BOT_API_KEY`    | **yes**  | Telegram bot token from @BotFather |
| `WEBHOOK_URL`    | no       | Public base URL of your server. If set, the bot switches from long polling to webhook mode |
| `WEBHOOK_SECRET` | no*      | Random string Telegram sends with every update, so the server can reject forged requests |
| `PORT`           | no       | Port for the webhook HTTP server (default `3000`) |

\* Not enforced, but **strongly recommended** in webhook mode. Without it the bot logs a warning and accepts any request to the webhook path.

In webhook mode Telegram sends updates to `<WEBHOOK_URL>/telegram/webhook`.

---

## Deploying to Render

1. Create a new **Web Service** on Render from this repository.
2. Set **Build command** to `npm install` and **Start command** to `npm start`.
3. Add environment variables:
   - `BOT_API_KEY` — your bot token
   - `WEBHOOK_SECRET` — any random string
4. Deploy.

You don't need to set `WEBHOOK_URL` or `PORT`: the bot picks up Render's `RENDER_EXTERNAL_URL` and `PORT` automatically and registers the webhook on startup (retrying if Telegram rate-limits the request).

> [!WARNING]
> User sessions (saved city and coordinates) are kept **in memory**. They are lost when the process restarts, and users will need to pick their city again.

---

## How the warnings work

**🌧 Rain** — if it isn't raining already, the bot scans the next 12 hours and warns about the first hour with precipitation probability above 50%, including the time and the probability.

**🌡 Temperature** — compares the current temperature with the day's forecast minimum and maximum and warns when the difference is more than 10°C.

**💨 Wind** — scans the next 6 hours and reports when the wind moves to a different level (calm, moderate, strong, storm, hurricane) and when.

**👕 Clothing** — advice is picked from five temperature bands (25°C, 15°C, 5°C, −5°C and below), with extra tips for rain, snow, fog and thunderstorms.

**🏭 Air quality** — shown only when the European AQI is above 40, with PM10 and PM2.5 levels when they exceed safe values.

All thresholds live in [`src/services/constants.js`](src/services/constants.js), so you can tune them in one place.

---

## Under the hood

- **[grammY](https://grammy.dev)** bot framework, plain Node.js, no database.
- **Two run modes from one entry point:** long polling locally, webhook in production, with a secret token check and retries when Telegram rate-limits `setWebhook`.
- **Per-user rate limiting:** 5 requests per 10 seconds, so one user can't burn through the free weather APIs.
- **Resilient API calls:** 10-second timeouts and up to 3 attempts per request on errors and `429` responses.
- **Self-cleaning memory:** inactive sessions expire after 30 days, stale rate-limit entries are purged every minute.
- **Parallel work:** the air-quality request runs alongside the forecast analysis to keep replies fast.

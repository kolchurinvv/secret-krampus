import { defineMessages } from "../shared/i18n";

/** Copy shared across pages (app shell, crash screen). */
export const commonMessages = defineMessages({
  en: {
    appName: "Secret Krampus",
    crashTitle: "The elves dropped something 🎁",
    crashFallback: "Something went wrong.",
    reload: "Reload",
  },
  ru: {
    appName: "Тайный Крампус",
    crashTitle: "Эльфы что-то уронили 🎁",
    crashFallback: "Что-то пошло не так.",
    reload: "Обновить",
  },
});

import { defineMessages } from "../../shared/i18n";

// Captions for each half-star step (score 1..10).
const CAPTIONS_EN = [
  "Lump of coal 🪨",
  "Krampus-approved 😈",
  "Regift material 🔁",
  "Meh 😐",
  "It's… fine 🙂",
  "Pretty nice 😊",
  "Really good! 😄",
  "Love it ❤️",
  "Amazing! 🤩",
  "Best gift ever! 🎁",
];
const CAPTIONS_RU = [
  "Уголёк 🪨",
  "Крампус одобряет 😈",
  "Передарю 🔁",
  "Ну такое 😐",
  "Сойдёт 🙂",
  "Очень мило 😊",
  "Здорово! 😄",
  "Обожаю ❤️",
  "Потрясающе! 🤩",
  "Подарок года! 🎁",
];

/** Copy for the shared UI components (star slider, avatar upload, dialogs). */
export const componentMessages = defineMessages({
  en: {
    // Feedback (confirm dialog)
    cancel: "Cancel",
    ok: "OK",
    // StarSlider
    ratingLabel: "Gift rating",
    notRated: "Not rated",
    dragHint: "Drag across the stars",
    caption: (score: number) => CAPTIONS_EN[score - 1] ?? "",
    score: (stars: number) => `${stars.toFixed(1)} / 5`,
    valueText: (stars: number) => `${stars} of 5 stars`,
    // AvatarUpload
    changePhoto: "Change photo",
    changePhotoFor: (name: string) => `Change photo for ${name}`,
    unsupportedImage: "That image format isn't supported — try a JPG or PNG.",
    processFailed: "Couldn't process that image.",
    uploadFailed: "Upload failed",
  },
  ru: {
    cancel: "Отмена",
    ok: "ОК",
    ratingLabel: "Оценка подарка",
    notRated: "Без оценки",
    dragHint: "Проведи пальцем по звёздам",
    caption: (score: number) => CAPTIONS_RU[score - 1] ?? "",
    score: (stars: number) => `${stars.toFixed(1).replace(".", ",")} / 5`,
    valueText: (stars: number) => `${String(stars).replace(".", ",")} из 5 звёзд`,
    changePhoto: "Сменить фото",
    changePhotoFor: (name: string) => `Сменить фото: ${name}`,
    unsupportedImage: "Этот формат не поддерживается — попробуй JPG или PNG.",
    processFailed: "Не получилось обработать картинку.",
    uploadFailed: "Не удалось загрузить",
  },
});

import { defineMessages, en, ru } from "../../shared/i18n";

/** Better Auth error codes we translate on the login page. */
type AuthError = { code?: string; status?: number; message?: string } | null | undefined;

/** Copy for the login page and the personal /me page. */
export const meMessages = defineMessages({
  en: {
    // Login
    tagline: "Secret Santa, gift ratings & contests — no passwords, just your email.",
    signInTitle: "Sign in or sign up",
    emailLabel: "Your email",
    sending: "Sending…",
    sendCode: "Send me a code",
    notEmail: "That doesn't look like an email address.",
    sendFailed: "Couldn't send the code. Try again in a moment.",
    codeSent: (email: string) =>
      `We sent a 6-digit code to ${email}. Not there? Check your spam/junk folder — and use the newest email.`,
    offline: "Couldn't reach the North Pole. Check your connection.",
    codeLength: "The code has 6 digits.",
    codeFailed: "That code didn't work. Check it, or send a new one.",
    /** Better Auth's own (English) errors, by code; anything else shows as sent. */
    authError: (err: AuthError, fallback: string) => {
      if (err?.status === 429) return "Too many requests — wait a minute and try again.";
      switch (err?.code) {
        case "INVALID_OTP":
          return "That code didn't work. Check it, or send a new one.";
        case "OTP_EXPIRED":
          return "That code has expired — send a new one.";
        case "TOO_MANY_ATTEMPTS":
          return "Too many tries — send a new code.";
        default:
          return err?.message ?? fallback;
      }
    },
    codeTitle: "Enter your code",
    codeLabel: "6-digit code",
    nameLabel: "Your name (first time here)",
    checking: "Checking…",
    letMeIn: "Let me in",
    sendNewCode: "Send a new code",
    otherEmail: "Use a different email",

    // Me page shell
    signOutFailed: "Couldn't sign out — try again.",
    admin: "Admin",
    signOut: "Sign out",
    loadFailed: "Something went wrong",
    tryAgain: "Try again",

    // Match card
    matchTitle: "Your Secret Santa match",
    notInSanta: "You're not in the Secret Santa draw this time — but you can still win contest stars ⭐",
    waitingLead: "The elves haven't drawn your name yet.",
    signedUp: (n: number) => `${n} ${n === 1 ? "person has" : "people have"}`,
    waitingTail: "signed up so far. You'll get an email when it's done.",
    plotTwist: "Plot twist!",
    matchChanged: (date: string) => `Your match changed on ${date} because someone joined late.`,
    tapToReveal: "Tap to reveal who you're gifting",
    noPeeking: "Make sure nobody's peeking 👀",
    youreGifting: "You're gifting",
    hide: "Hide",
    hideMatch: "Hide match",
    theirWishlist: "Their wishlist",
    noWishlist: "No wishlist yet — improvise! 🎲",

    // Stars card
    stars: (n: number) => `${n} ${en(n, "star")}`,
    rank: (rank: number, total: number) => `#${rank} of ${total} on the leaderboard`,

    // Profile card
    needName: "Please tell us your name 🙂",
    saved: "Saved ✓",
    profileTitle: "Your profile",
    whatName: "What should we call you? 🎅",
    nameShows: "Your name shows up on the TV and on the leaderboard.",
    lookingGood: "Looking good! 📸",
    photoHint: "Tap your picture to add a photo — it shows on the leaderboard and (gulp) in the Krampus reveal.",
    nameField: "Name",
    wishlistField: "Wishlist / gift hints",
    wishlistNote: "Your Secret Santa sees your wishlist (but not who they are to you 🤫).",
    saving: "Saving…",
    save: "Save",

    // Voting card
    myGift: "The gift you received",
    giftFor: (name: string) => `${name}'s gift`,
    stateSaving: "saving…",
    stateSaved: "saved ✓",
    stateError: "not saved",
    rateMine: "Rate the gift you received",
    rateFor: (name: string) => `Rate ${name}'s gift`,
    votesIn: "Votes are in! 📺",
    watchTv: "Watch the TV — the Secret Krampus will be revealed soon…",
    beHonest: "Be honest — the lowest-rated gift crowns the Secret Krampus 😈",
    tie: "It's a tie! 😬",
    tieRound: (round: number) => `Round ${round}: everyone rates these gifts. Lowest average gets the horns.`,
    nothingToRate: "Nothing for you to rate this round — sit back and enjoy the show 🍪",
    canChange: "You can change your rating until the round closes.",
  },
  ru: {
    tagline: "Тайный Санта, оценки подарков и конкурсы — без паролей, только твоя почта.",
    signInTitle: "Вход или регистрация",
    emailLabel: "Твоя почта",
    sending: "Отправляем…",
    sendCode: "Получить код",
    notEmail: "Это не похоже на адрес почты.",
    sendFailed: "Не получилось отправить код. Попробуй ещё раз чуть позже.",
    codeSent: (email: string) =>
      `Мы отправили 6-значный код на ${email}. Не пришёл? Загляни в папку «Спам» — и бери код из самого свежего письма.`,
    offline: "Не удаётся связаться с Северным полюсом. Проверь интернет.",
    codeLength: "В коде 6 цифр.",
    codeFailed: "Код не подошёл. Проверь его или запроси новый.",
    authError: (err: AuthError, fallback: string) => {
      if (err?.status === 429) return "Слишком много запросов — подожди минутку и попробуй снова.";
      switch (err?.code) {
        case "INVALID_OTP":
          return "Код не подошёл. Проверь его или запроси новый.";
        case "OTP_EXPIRED":
          return "Срок действия кода истёк — запроси новый.";
        case "TOO_MANY_ATTEMPTS":
          return "Слишком много попыток — запроси новый код.";
        default:
          return err?.message ?? fallback;
      }
    },
    codeTitle: "Введи код",
    codeLabel: "Код из 6 цифр",
    nameLabel: "Твоё имя (если ты здесь впервые)",
    checking: "Проверяем…",
    letMeIn: "Войти",
    sendNewCode: "Прислать новый код",
    otherEmail: "Другая почта",

    signOutFailed: "Не получилось выйти — попробуй ещё раз.",
    admin: "Админка",
    signOut: "Выйти",
    loadFailed: "Что-то пошло не так",
    tryAgain: "Попробовать снова",

    matchTitle: "Кому ты даришь",
    notInSanta: "В этот раз ты не участвуешь в жеребьёвке Тайного Санты — но звёзды в конкурсах всё равно можно выиграть ⭐",
    waitingLead: "Эльфы ещё не провели жеребьёвку.",
    signedUp: (n: number) => ru(n, `Записался ${n} человек`, `Записались ${n} человека`, `Записались ${n} человек`),
    waitingTail: "— когда всё будет готово, тебе придёт письмо.",
    plotTwist: "Сюжетный поворот!",
    matchChanged: (date: string) => `Кто-то присоединился позже, и ${date} тебе выпал другой получатель.`,
    tapToReveal: "Нажми, чтобы узнать, кому ты даришь",
    noPeeking: "Убедись, что никто не подглядывает 👀",
    youreGifting: "Ты — Тайный Санта для",
    hide: "Скрыть",
    hideMatch: "Скрыть получателя",
    theirWishlist: "Вишлист получателя",
    noWishlist: "Вишлиста пока нет — импровизируй! 🎲",

    stars: (n: number) => `${n} ${ru(n, "звезда", "звезды", "звёзд")}`,
    rank: (rank: number, total: number) => `#${rank} из ${total} в общем зачёте`,

    needName: "Напиши, как тебя зовут 🙂",
    saved: "Сохранено ✓",
    profileTitle: "Твой профиль",
    whatName: "Как тебя зовут? 🎅",
    nameShows: "Твоё имя будет на экране и в общем зачёте.",
    lookingGood: "Красота! 📸",
    photoHint: "Нажми на аватар, чтобы добавить фото — оно появится в общем зачёте и (ой) при разоблачении Крампуса.",
    nameField: "Имя",
    wishlistField: "Вишлист / подсказки к подарку",
    wishlistNote: "Твой Тайный Санта увидит этот вишлист (но кто он — останется тайной 🤫).",
    saving: "Сохраняем…",
    save: "Сохранить",

    myGift: "Подарок тебе",
    giftFor: (name: string) => `Подарок для ${name}`,
    stateSaving: "сохраняем…",
    stateSaved: "сохранено ✓",
    stateError: "не сохранено",
    rateMine: "Оцени подарок, который тебе достался",
    rateFor: (name: string) => `Оцени подарок для ${name}`,
    votesIn: "Голоса подсчитаны! 📺",
    watchTv: "Смотри на экран — скоро узнаем, кто Тайный Крампус…",
    beHonest: "Только честно — даритель подарка с самой низкой оценкой станет Тайным Крампусом 😈",
    tie: "Ничья! 😬",
    tieRound: (round: number) =>
      `Раунд ${round}: эти подарки оценивают все. Рога достанутся дарителю с самой низкой средней оценкой.`,
    nothingToRate: "В этом раунде тебе нечего оценивать — расслабься и наслаждайся шоу 🍪",
    canChange: "Оценку можно менять, пока раунд не закрыт.",
  },
});

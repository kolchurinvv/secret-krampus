import { defineMessages, en, ru } from "../../shared/i18n";

/** "1.5" in English, "1,5" in Russian; whole numbers without decimals. */
const score = (stars: number) => stars.toFixed(stars % 1 === 0 ? 0 : 1);

/** Every word the TV shows. English must stay exactly as the e2e suite reads it. */
export const tvMessages = defineMessages({
  en: {
    connecting: "Connecting to the North Pole…",
    startShow: "Click to start the show",
    startHint: "fullscreen + sound",

    appTitle: "Secret Krampus",

    lobbyHeading: "Join the party!",
    lobbyHint: "Scan, sign up, get a Secret Santa match 🎁",
    signedUp: (n: number) => (n === 1 ? "elf has signed up" : "elves have signed up"),

    votingDoneTitle: "All votes are in…",
    votingDoneSub: "Who is the Secret Krampus? 🥁",
    tieTitle: (round: number) => `It's a tie! 😱 Round ${round}`,
    tieSub: (host: string) => `Everyone rates these gifts on ${host}`,
    openTitle: "Rate your Secret Santa gift! 🎁",
    openSub: (host: string) => `Open ${host} on your phone`,
    soonTitle: "Gift voting opens soon 🎁",
    soonSub: "Get your phones ready",
    voted: "voted",
    giftFor: (name: string) => `${name}'s gift`,

    krampusDeciding: "The Krampus is being decided… 🥁",
    krampusDrumroll: "And the Secret Krampus is",
    krampusTitle: (many: boolean) => (many ? "SECRET KRAMPUSES" : "SECRET KRAMPUS"),
    krampusForGift: (name: string) => `for the gift to ${name}`,
    krampusScore: (stars: number) => `${score(stars)} / 5`,
    krampusCoal: "🪨 Enjoy your lump of coal 🪨",

    championCrowning: "Crowning the champion… 🥁",
    championDrumroll: "And the champion is",
    championTitle: (many: boolean) => (many ? "CHAMPIONS" : "CHAMPION"),
    championStars: (n: number) => `⭐ ${n} ${en(n, "star")}`,

    standings: "🏆 Overall standings",
    nowPlaying: "Now playing:",
    oneStar: "+1 star",
    and: "&",

    mockLabel: "MOCK",
    mockPaused: " (paused)",
    mockKeys: "1–6 scenes · a award · n new · v voting · r replay · p pause",
  },
  ru: {
    connecting: "Связываемся с Северным полюсом…",
    startShow: "Нажми, чтобы начать шоу",
    startHint: "полный экран + звук",

    appTitle: "Тайный Крампус",

    lobbyHeading: "Присоединяйся!",
    lobbyHint: "Сканируй, регистрируйся — и узнаешь, кому ты Тайный Санта 🎁",
    signedUp: (n: number) => ru(n, "эльф уже с нами", "эльфа уже с нами", "эльфов уже с нами"),

    votingDoneTitle: "Все голоса собраны…",
    votingDoneSub: "Так кто же Тайный Крампус? 🥁",
    tieTitle: (round: number) => `Ничья! 😱 Раунд ${round}`,
    tieSub: (host: string) => `Теперь эти подарки оценивают все — на ${host}`,
    openTitle: "Оцени подарок от Тайного Санты! 🎁",
    openSub: (host: string) => `Открой ${host} на телефоне`,
    soonTitle: "Скоро будем оценивать подарки 🎁",
    soonSub: "Доставайте телефоны",
    voted: "оценили",
    giftFor: (name: string) => `Подарок: ${name}`,

    krampusDeciding: "Решаем, кто Крампус… 🥁",
    krampusDrumroll: "Тайным Крампусом становится",
    krampusTitle: (many: boolean) => (many ? "ТАЙНЫЕ КРАМПУСЫ" : "ТАЙНЫЙ КРАМПУС"),
    krampusForGift: (name: string) => `за подарок для получателя: ${name}`,
    krampusScore: (stars: number) => `${score(stars).replace(".", ",")} / 5`,
    krampusCoal: "🪨 Держи свой уголёк 🪨",

    championCrowning: "Коронуем чемпиона… 🥁",
    championDrumroll: "Чемпионом становится",
    championTitle: (many: boolean) => (many ? "ЧЕМПИОНЫ" : "ЧЕМПИОН"),
    championStars: (n: number) => `⭐ ${n} ${ru(n, "звезда", "звезды", "звёзд")}`,

    standings: "🏆 Общий зачёт",
    nowPlaying: "Сейчас идёт:",
    oneStar: "+1 звезда",
    and: "и",

    mockLabel: "ДЕМО",
    mockPaused: " (пауза)",
    mockKeys: "1–6 сцены · a звёзды · n новый · v голосование · r повтор · p пауза",
  },
});

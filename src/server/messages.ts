// Copy the server produces: API error messages (shown as-is by the client)
// and emails. It follows the party's language at the moment it's produced.
import { defineMessages, ru } from "../shared/i18n";
import { getState } from "./services/state";

export const serverMessages = defineMessages({
  en: {
    mysteryElf: "Mystery elf",

    // scene / language
    unknownScene: "Unknown scene.",
    krampusNotDecided: "The Krampus isn't decided yet — finish the voting first.",
    noKrampus: "Nobody rated any gift, so there's no Krampus to reveal.",
    noStarsYet: "Nobody has any stars yet.",
    badLocale: "Language must be ru or en.",
    messageNotText: "Message must be text.",

    // voting
    votingStarted: "Voting has already started. Reset it to start over.",
    assignFirst: "Assign the Secret Santa first.",
    noRoundOpen: "No voting round is open.",
    whichGift: "Which gift?",
    badScore: (min: number, max: number) => `Score must be a whole number from ${min} to ${max}.`,
    votingClosed: "Voting isn't open right now.",
    giftNotInRound: "That gift isn't being rated this round.",
    noVoteOnGift: "You don't get a vote on that gift this round.",

    // contests & stars
    noSuchContest: "No such contest.",
    pickSomeone: "Pick at least one person.",
    nobodyExists: "None of those people exist.",
    who: "Who?",
    noStarsToTake: "They have no stars to take away.",
    noStarsInContest: "None of them have stars in this contest to take away.",
    noneHaveStars: "None of them have stars to take away.",
    nothingToUndo: "Nothing to undo.",
    badStarCount: "Stars must be a whole number from 0 to 999.",
    nameTheContest: "Give the contest a name.",
    badContestKind: "Kind must be individual or team.",
    contestHasStars: (name: string, n: number) =>
      `“${name}” still has ${n} ⭐ awarded. Take them back first (−1), then delete it.`,

    // secret santa
    santaLocked: "Krampus voting has started — reset the voting first to change the Secret Santa.",
    tooFewForDraw: (min: number) => `Need at least ${min} people in the Secret Santa to draw.`,
    noAssignment: "That person has no assignment yet.",
    noEmailAddress: "No email address",

    // people
    noSuchPerson: "No such person.",
    nameNotText: "Name must be text.",
    nameEmpty: "Name can't be empty.",
    nameTooLong: (max: number) => `Name is too long (max ${max}).`,
    emailNotText: "Email must be text.",
    emailInvalid: "That email doesn't look right.",
    emailTaken: "Someone with that email already exists.",
    wishlistNotText: "Wishlist must be text.",
    emailLocked: "This person signs in with their own email; it can't be changed here.",
    inSantaNotBool: "inSanta must be true or false.",

    // avatars
    attachImage: "Attach an image as 'file'.",
    imageTooBig: "That image is too big (max 2 MB).",
    imageType: "Use a JPEG, PNG or WebP image.",

    serverError: "Something went wrong on our side.",
    notSignedIn: "Not signed in",
    adminsOnly: "Admins only",
    notFound: "Not found",

    // emails
    emailBrand: "Secret Krampus",
    otpSubject: (otp: string) => `Your Secret Krampus code: ${otp}`,
    otpTitle: "Your login code",
    otpIntro: "Type this code into Secret Krampus:",
    otpExpiry: "It expires in 10 minutes. If you didn't ask for it, ignore this email.",
    otpText: (otp: string) => `Your login code is ${otp}. It expires in 10 minutes.`,
    matchSubject: "🎁 Your Secret Santa match is in",
    twistSubject: "🎁 Plot twist: your Secret Santa match changed",
    matchTitle: "Ho ho ho!",
    twistTitle: "Plot twist!",
    matchIntro: (giver: string) => `Hi ${giver}, the elves have drawn the names. You are the Secret Santa for:`,
    twistIntro: (giver: string) =>
      `Hi ${giver}, someone joined the party late, so the elves had to reshuffle a little. <b>Forget the previous email</b> — you are now the Secret Santa for:`,
    theirWishlist: "Their wishlist:",
    keepSecret: "Keep it secret. Choose wisely — the worst-rated gift of the night crowns its giver the <b>Secret Krampus</b>. 😈",
    seeItAgain: "See it again any time on the site",
    matchText: (giver: string, receiver: string, changed: boolean) =>
      `${changed ? "Plot twist! Your match changed. Forget the previous email. " : ""}Hi ${giver}, you are the Secret Santa for: ${receiver}.`,
    wishlistText: (w: string) => `Their wishlist: ${w}`,
    keepSecretText: "Keep it secret.",
  },
  ru: {
    mysteryElf: "Таинственный эльф",

    unknownScene: "Неизвестная сцена.",
    krampusNotDecided: "Крампус ещё не определён — сначала закончи голосование.",
    noKrampus: "Никто не оценил ни одного подарка, так что раскрывать некого.",
    noStarsYet: "Пока ни у кого нет звёзд.",
    badLocale: "Язык должен быть ru или en.",
    messageNotText: "Объявление должно быть текстом.",

    votingStarted: "Голосование уже началось. Сбрось его, чтобы начать заново.",
    assignFirst: "Сначала проведи жеребьёвку Тайного Санты.",
    noRoundOpen: "Сейчас нет открытого раунда.",
    whichGift: "Какой подарок?",
    badScore: (min: number, max: number) => `Оценка — целое число от ${min} до ${max}.`,
    votingClosed: "Голосование сейчас закрыто.",
    giftNotInRound: "Этот подарок в этом раунде не оценивают.",
    noVoteOnGift: "В этом раунде ты не голосуешь за этот подарок.",

    noSuchContest: "Такого конкурса нет.",
    pickSomeone: "Выбери хотя бы одного человека.",
    nobodyExists: "Таких людей нет.",
    who: "Кого?",
    noStarsToTake: "У этого человека нет звёзд — забирать нечего.",
    noStarsInContest: "Ни у кого из выбранных нет звёзд в этом конкурсе.",
    noneHaveStars: "Ни у кого из выбранных нет звёзд.",
    nothingToUndo: "Отменять нечего.",
    badStarCount: "Количество звёзд — целое число от 0 до 999.",
    nameTheContest: "Дай конкурсу название.",
    badContestKind: "Тип конкурса: личный или командный.",
    contestHasStars: (name: string, n: number) =>
      `В конкурсе «${name}» ещё ${n} ${ru(n, "звезда", "звезды", "звёзд")}. Сначала забери их (−1), потом удаляй.`,

    santaLocked: "Голосование за Крампуса уже началось — чтобы менять Тайного Санту, сначала сбрось голосование.",
    tooFewForDraw: (min: number) => `Для жеребьёвки нужно минимум ${min} ${ru(min, "участник", "участника", "участников")}.`,
    noAssignment: "У этого человека ещё нет пары.",
    noEmailAddress: "Нет адреса почты",

    noSuchPerson: "Такого человека нет.",
    nameNotText: "Имя должно быть текстом.",
    nameEmpty: "Имя не может быть пустым.",
    nameTooLong: (max: number) => `Слишком длинное имя (максимум ${max} ${ru(max, "символ", "символа", "символов")}).`,
    emailNotText: "Почта должна быть текстом.",
    emailInvalid: "Похоже, в адресе почты ошибка.",
    emailTaken: "Человек с такой почтой уже есть.",
    wishlistNotText: "Вишлист должен быть текстом.",
    emailLocked: "Этот человек входит со своей почтой — здесь её поменять нельзя.",
    inSantaNotBool: "inSanta должно быть true или false.",

    attachImage: "Прикрепи картинку в поле «file».",
    imageTooBig: "Картинка слишком большая (максимум 2 МБ).",
    imageType: "Подойдёт JPEG, PNG или WebP.",

    serverError: "У нас что-то сломалось.",
    notSignedIn: "Сначала войди",
    adminsOnly: "Только для админов",
    notFound: "Не найдено",

    emailBrand: "Тайный Крампус",
    otpSubject: (otp: string) => `Код для входа в Тайный Крампус: ${otp}`,
    otpTitle: "Твой код для входа",
    otpIntro: "Введи этот код на сайте Тайного Крампуса:",
    otpExpiry: "Код действует 10 минут. Если это был не ты, просто проигнорируй письмо.",
    otpText: (otp: string) => `Твой код для входа: ${otp}. Он действует 10 минут.`,
    matchSubject: "🎁 Жеребьёвка Тайного Санты: кому ты даришь подарок",
    twistSubject: "🎁 Сюжетный поворот: у тебя новый получатель",
    matchTitle: "Хо-хо-хо!",
    twistTitle: "Сюжетный поворот!",
    matchIntro: (giver: string) => `Привет, ${giver}! Эльфы провели жеребьёвку. Ты — Тайный Санта для:`,
    twistIntro: (giver: string) =>
      `Привет, ${giver}! На вечеринку кто-то опоздал, и эльфам пришлось немного всё перемешать. <b>Забудь прошлое письмо</b> — теперь ты Тайный Санта для:`,
    theirWishlist: "Вишлист:",
    keepSecret: "Никому ни слова! И выбирай с умом — даритель худшего подарка вечера станет <b>Тайным Крампусом</b>. 😈",
    seeItAgain: "Посмотреть ещё раз можно на сайте",
    matchText: (giver: string, receiver: string, changed: boolean) =>
      `${changed ? "Сюжетный поворот! У тебя новый получатель, забудь прошлое письмо. " : ""}Привет, ${giver}! Ты — Тайный Санта для: ${receiver}.`,
    wishlistText: (w: string) => `Вишлист: ${w}`,
    keepSecretText: "Никому ни слова!",
  },
});

/** The server's copy in the party's current language. */
export const tr = () => serverMessages[getState().locale];

import { useNavigate } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { authClient } from "../lib/auth-client";
import { useMessages } from "../lib/i18n";
import { meMessages } from "../me/messages";
import { commonMessages } from "../messages";
import "../styles/app.css";

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = createSignal<"email" | "code">("email");
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [name, setName] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const m = useMessages(meMessages);
  const common = useMessages(commonMessages);
  // Kept as functions of the current language, so switching it re-renders them.
  const [error, setErrorFn] = createSignal<(() => string) | null>(null);
  const setError = (msg: (() => string) | null) => setErrorFn(() => msg);
  const [sentTo, setSentTo] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const s = await authClient.getSession();
      if (s.data?.user) navigate("/me", { replace: true });
    } catch {
      /* not signed in */
    }
  });

  const normalizedEmail = () => email().trim().toLowerCase();

  const sendCode = async (e?: Event) => {
    e?.preventDefault();
    if (!normalizedEmail().includes("@")) {
      setError(() => m().notEmail);
      return;
    }
    setBusy(true);
    setError(null);
    setSentTo(null);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: normalizedEmail(), type: "sign-in" });
      if (error) {
        setError(() => m().authError(error, m().sendFailed));
        return;
      }
      setStep("code");
      setSentTo(normalizedEmail());
    } catch {
      setError(() => m().offline);
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (e: Event) => {
    e.preventDefault();
    const otp = code().replace(/\D/g, "");
    if (otp.length !== 6) {
      setError(() => m().codeLength);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trimmedName = name().trim();
      const { error } = await authClient.signIn.emailOtp({
        email: normalizedEmail(),
        otp,
        ...(trimmedName ? { name: trimmedName } : {}),
      });
      if (error) {
        setError(() => m().authError(error, m().codeFailed));
        return;
      }
      navigate("/me", { replace: true });
    } catch {
      setError(() => m().offline);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="sk-page sk-login">
      <header class="sk-hero center-align">
        <div class="sk-hero-emoji" aria-hidden="true">
          🎄😈🎁
        </div>
        <h1 class="sk-display sk-hero-title">{common().appName}</h1>
        <p class="sk-muted">{m().tagline}</p>
      </header>

      <article class="round sk-card">
        <Show
          when={step() === "code"}
          fallback={
            <form onSubmit={sendCode} class="sk-stack">
              <h6>{m().signInTitle}</h6>
              <div class="field label border round">
                <input
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  placeholder=" "
                  required
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                />
                <label>{m().emailLabel}</label>
              </div>
              <button class="responsive large round" type="submit" disabled={busy()}>
                <i>mail</i>
                <span>{busy() ? m().sending : m().sendCode}</span>
              </button>
            </form>
          }
        >
          <form onSubmit={signIn} class="sk-stack">
            <h6>{m().codeTitle}</h6>
            <Show when={sentTo()}>
              {(to) => <p class="sk-muted sk-m0">{m().codeSent(to())}</p>}
            </Show>
            <div class="field label border round">
              <input
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9 ]*"
                maxlength={7}
                // A small intrinsic width: the big OTP font times the default 20 chars
                // was wider than a 390px phone and made the page scroll sideways.
                size={6}
                placeholder=" "
                class="sk-otp"
                required
                value={code()}
                onInput={(e) => setCode(e.currentTarget.value)}
              />
              <label>{m().codeLabel}</label>
            </div>
            <div class="field label border round">
              <input
                type="text"
                autocomplete="name"
                placeholder=" "
                maxlength={60}
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
              <label>{m().nameLabel}</label>
            </div>
            <button class="responsive large round" type="submit" disabled={busy()}>
              <i>login</i>
              <span>{busy() ? m().checking : m().letMeIn}</span>
            </button>
            <nav class="center-align wrap">
              <button type="button" class="transparent small" disabled={busy()} onClick={() => void sendCode()}>
                {m().sendNewCode}
              </button>
              <button
                type="button"
                class="transparent small"
                disabled={busy()}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setSentTo(null);
                }}
              >
                {m().otherEmail}
              </button>
            </nav>
          </form>
        </Show>
        <Show when={error()}>
          {(msg) => (
            <p class="sk-error" role="alert">
              {msg()()}
            </p>
          )}
        </Show>
      </article>
    </main>
  );
}

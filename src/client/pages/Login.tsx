import { useNavigate } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { authClient } from "../lib/auth-client";
import "../styles/app.css";

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = createSignal<"email" | "code">("email");
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [name, setName] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");

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
      setError("That doesn't look like an email address.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: normalizedEmail(), type: "sign-in" });
      if (error) {
        setError(error.message ?? "Couldn't send the code. Try again in a moment.");
        return;
      }
      setStep("code");
      setNotice(
        `We sent a 6-digit code to ${normalizedEmail()}. Not there? Check your spam/junk folder — and use the newest email.`,
      );
    } catch {
      setError("Couldn't reach the North Pole. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (e: Event) => {
    e.preventDefault();
    const otp = code().replace(/\D/g, "");
    if (otp.length !== 6) {
      setError("The code has 6 digits.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const trimmedName = name().trim();
      const { error } = await authClient.signIn.emailOtp({
        email: normalizedEmail(),
        otp,
        ...(trimmedName ? { name: trimmedName } : {}),
      });
      if (error) {
        setError(error.message ?? "That code didn't work. Check it, or send a new one.");
        return;
      }
      navigate("/me", { replace: true });
    } catch {
      setError("Couldn't reach the North Pole. Check your connection.");
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
        <h1 class="sk-display sk-hero-title">Secret Krampus</h1>
        <p class="sk-muted">Secret Santa, gift ratings &amp; contests — no passwords, just your email.</p>
      </header>

      <article class="round sk-card">
        <Show
          when={step() === "code"}
          fallback={
            <form onSubmit={sendCode} class="sk-stack">
              <h6>Sign in or sign up</h6>
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
                <label>Your email</label>
              </div>
              <button class="responsive large round" type="submit" disabled={busy()}>
                <i>mail</i>
                <span>{busy() ? "Sending…" : "Send me a code"}</span>
              </button>
            </form>
          }
        >
          <form onSubmit={signIn} class="sk-stack">
            <h6>Enter your code</h6>
            <Show when={notice()}>
              <p class="sk-muted sk-m0">{notice()}</p>
            </Show>
            <div class="field label border round">
              <input
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9 ]*"
                maxlength={7}
                placeholder=" "
                class="sk-otp"
                required
                value={code()}
                onInput={(e) => setCode(e.currentTarget.value)}
              />
              <label>6-digit code</label>
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
              <label>Your name (first time here)</label>
            </div>
            <button class="responsive large round" type="submit" disabled={busy()}>
              <i>login</i>
              <span>{busy() ? "Checking…" : "Let me in"}</span>
            </button>
            <nav class="center-align wrap">
              <button type="button" class="transparent small" disabled={busy()} onClick={() => void sendCode()}>
                Send a new code
              </button>
              <button
                type="button"
                class="transparent small"
                disabled={busy()}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setNotice("");
                }}
              >
                Use a different email
              </button>
            </nav>
          </form>
        </Show>
        <Show when={error()}>
          <p class="sk-error" role="alert">
            {error()}
          </p>
        </Show>
      </article>
    </main>
  );
}

import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

// Same origin in dev (Vite proxies /api) and in production.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [emailOTPClient()],
});

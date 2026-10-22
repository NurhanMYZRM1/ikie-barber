"use client";
// Keep pending/error state next to the fields while the server verifies the owner.
import { useActionState } from "react";
import { login } from "@/app/admin/login/actions";
import { useT } from "./lang";

export function LoginForm({ configured }: { configured: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form action={action} className="space-y-5">
      <label>
        {t("ID")}
        <input
          name="id"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </label>
      <label>
        {t("Password")}
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && (
        <p className="field-error" role="alert">
          {t(state.error)}
        </p>
      )}
      <button disabled={pending || !configured} className="btn-primary w-full">
        {pending ? t("Signing in…") : t("Sign in")}
      </button>
    </form>
  );
}

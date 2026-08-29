"use client";

import { useActionState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { authenticate } from "./actions";

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <label htmlFor="guardian-login-email" className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Email</span>
        <input
          id="guardian-login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </label>
      <label htmlFor="guardian-login-password" className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Password</span>
        <input
          id="guardian-login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </label>
      <input type="hidden" name="redirectTo" value="/app" />
      {errorMessage ? (
        <div className="rounded-[14px] border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 font-mono text-xs font-medium uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? <LockKeyhole className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
        Sign in
      </button>
    </form>
  );
}

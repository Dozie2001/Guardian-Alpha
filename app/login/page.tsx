import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/app");
  }

  return (
    <main className="floor-texture flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="market-panel w-full max-w-md p-5 md:p-7">
        <Link href="/" className="inline-flex h-10 items-center font-mono text-xs font-semibold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Guardian
        </Link>
        <div className="mt-8 space-y-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="section-kicker">Operator access</p>
          <h1 className="text-3xl font-extrabold leading-none">Sign in to the paper trading console</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Access is restricted to the configured Guardian operator while the product is in paper trading preview.
          </p>
        </div>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

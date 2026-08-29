"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="floor-texture flex min-h-screen items-center justify-center bg-background px-4">
      <section className="market-panel w-full max-w-md p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Guardian could not load
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This is usually a local development hiccup. Retry the page after the dev server settles.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 font-mono text-xs font-medium uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </section>
    </main>
  );
}

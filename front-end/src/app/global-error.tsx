"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Unexpected error
            </p>
            <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The error was captured for investigation. Try the action again or
              refresh the page.
            </p>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => reset()}>Try again</Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

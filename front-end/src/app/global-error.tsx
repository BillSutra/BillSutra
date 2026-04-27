"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { captureFrontendSentryException } from "@/lib/observability/sentry";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  translate,
} from "@/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void captureFrontendSentryException(error);
  }, [error]);

  const language = useMemo(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LANGUAGE;
    }

    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  }, []);

  return (
    <html>
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {translate(language, "globalError.kicker")}
            </p>
            <h1 className="mt-3 text-2xl font-semibold">
              {translate(language, "globalError.title")}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {translate(language, "globalError.description")}
            </p>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => reset()}>
                {translate(language, "globalError.action")}
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

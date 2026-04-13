import Link from "next/link";

type AuthErrorPageProps = {
  searchParams?: {
    error?: string;
  };
};

const ERROR_COPY: Record<string, string> = {
  AccessDenied: "Sign-in was denied. Please try again.",
  OAuthCallback: "Google sign-in could not be completed. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
};

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const errorCode = searchParams?.error ?? "Unknown";
  const message =
    ERROR_COPY[errorCode] ??
    "Authentication failed due to an unexpected error. Please try again.";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Unable to sign in</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <p className="mt-2 text-xs text-muted-foreground">Error code: {errorCode}</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Back to login
        </Link>
        <Link
          href="/"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}

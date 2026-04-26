"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  resendVerificationEmail,
  verifyEmailAddress,
} from "@/lib/authClient";
import {
  bootstrapSecureAuthSession,
  isSecureAuthEnabled,
} from "@/lib/secureAuth";
import { captureFrontendException } from "@/lib/observability/shared";
import {
  AlertTriangle,
  LoaderCircle,
  MailCheck,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

const VerifyEmailPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = searchParams.get("token")?.trim() ?? "";
  const verificationStartedRef = useRef(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [message, setMessage] = useState(
    "We sent a verification email. Open the link in your inbox to unlock full access.",
  );
  const [statusVariant, setStatusVariant] = useState<
    "pending" | "success" | "error"
  >("pending");

  useEffect(() => {
    if (retryAfter <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRetryAfter((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [retryAfter]);

  useEffect(() => {
    const verified =
      typeof session?.user?.is_email_verified === "boolean"
        ? session.user.is_email_verified
        : null;

    if (!token && verified) {
      router.replace("/dashboard");
    }
  }, [router, session?.user?.is_email_verified, token]);

  useEffect(() => {
    if (!token || verificationStartedRef.current) {
      return;
    }

    verificationStartedRef.current = true;
    setIsVerifying(true);
    setStatusVariant("pending");
    setMessage("Verifying your email...");

    void verifyEmailAddress(token)
      .then(async (result) => {
        setStatusVariant("success");
        setMessage("Your email has been verified. Redirecting you to your dashboard...");

        if (result.token?.trim()) {
          const bearerToken = result.token.startsWith("Bearer ")
            ? result.token
            : `Bearer ${result.token}`;

          const signInResult = await signIn("auth-token", {
            token: bearerToken,
            redirect: false,
          });

          if (!signInResult?.error && isSecureAuthEnabled()) {
            await bootstrapSecureAuthSession(bearerToken);
          }
        }

        router.replace("/dashboard");
      })
      .catch((error) => {
        captureFrontendException(error, {
          tags: {
            flow: "auth.verify_email",
          },
        });
        setStatusVariant("error");
        setMessage(
          error instanceof Error && error.message.trim()
            ? error.message
            : "This verification link is invalid or expired.",
        );
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [router, token]);

  const handleResend = async () => {
    setIsResending(true);
    try {
      const response = await resendVerificationEmail();
      setStatusVariant("pending");
      setMessage("A fresh verification email is on the way. Please check your inbox.");
      if (typeof response?.retryAfter === "number" && response.retryAfter > 0) {
        setRetryAfter(response.retryAfter);
      } else {
        setRetryAfter(60);
      }
    } catch (error) {
      captureFrontendException(error, {
        tags: {
          flow: "auth.resend_verification",
        },
      });
      if (
        error instanceof Error &&
        "retryAfter" in error &&
        typeof error.retryAfter === "number" &&
        error.retryAfter > 0
      ) {
        setRetryAfter(error.retryAfter);
      }
      setStatusVariant("error");
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to resend verification email right now.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const email = session?.user?.email?.trim() ?? "";
  const isAuthenticated = status === "authenticated";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-border/80 bg-card p-8 shadow-[0_36px_110px_-70px_rgba(17,37,63,0.4)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            {statusVariant === "success" ? (
              <ShieldCheck className="h-6 w-6" />
            ) : statusVariant === "error" ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <MailCheck className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {statusVariant === "success"
                ? "Email verified"
                : "Verify your email"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Full workspace access unlocks after email confirmation.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
          <p>{message}</p>
          {email ? (
            <p className="mt-3 font-medium text-foreground">{email}</p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3">
          {!token && isAuthenticated ? (
            <Button
              type="button"
              onClick={() => void handleResend()}
              disabled={isResending || retryAfter > 0}
            >
              {isResending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Sending verification email...
                </>
              ) : retryAfter > 0 ? (
                `Resend in ${retryAfter}s`
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" />
                  Resend verification email
                </>
              )}
            </Button>
          ) : null}

          {isVerifying ? (
            <Button type="button" disabled>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Verifying email...
            </Button>
          ) : null}

          {statusVariant === "success" ? (
            <Button type="button" onClick={() => router.replace("/dashboard")}>
              Continue to dashboard
            </Button>
          ) : null}

          {!isAuthenticated ? (
            <Button asChild variant="outline">
              <Link href="/login">Back to login</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/login">Use another account</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;

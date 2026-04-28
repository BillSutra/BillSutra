"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resendEmailVerificationOtp,
  verifyEmailAddress,
  verifyEmailVerificationOtp,
} from "@/lib/authClient";
import {
  bootstrapSecureAuthSession,
  getPendingRememberMePreference,
  isSecureAuthEnabled,
} from "@/lib/secureAuth";
import { captureFrontendException } from "@/lib/observability/shared";
import { toast } from "sonner";
import {
  AlertTriangle,
  LoaderCircle,
  MailCheck,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

const OTP_LENGTH = 6;
const DEFAULT_RETRY_AFTER = 60;
const DEFAULT_EXPIRES_IN = 10 * 60;

const VerifyEmailPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = searchParams.get("token")?.trim() ?? "";
  const initialEmail = searchParams.get("email")?.trim() ?? "";
  const initialRetryAfter = Number.parseInt(
    searchParams.get("retryAfter") ?? "",
    10,
  );
  const initialExpiresIn = Number.parseInt(
    searchParams.get("expiresIn") ?? "",
    10,
  );
  const deliveryFailed = searchParams.get("delivery") === "failed";

  const verificationStartedRef = useRef(false);
  const otpMode = !token;
  const sessionEmail = session?.user?.email?.trim() ?? "";
  const resolvedEmail = useMemo(
    () => initialEmail || sessionEmail,
    [initialEmail, sessionEmail],
  );

  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [retryAfter, setRetryAfter] = useState(
    Number.isFinite(initialRetryAfter) && initialRetryAfter > 0
      ? initialRetryAfter
      : DEFAULT_RETRY_AFTER,
  );
  const [expiresIn, setExpiresIn] = useState(
    Number.isFinite(initialExpiresIn) && initialExpiresIn > 0
      ? initialExpiresIn
      : DEFAULT_EXPIRES_IN,
  );
  const [message, setMessage] = useState(
    deliveryFailed
      ? "Your account is ready, but we could not send the verification code yet. Request a new OTP to continue."
      : otpMode
        ? "Enter the 6-digit OTP we sent to your email to verify your BillSutra account."
        : "We sent a verification email. Open the link in your inbox to unlock full access.",
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
    if (expiresIn <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setExpiresIn((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresIn]);

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
        setMessage("Email verified successfully. Redirecting you to your dashboard...");

        if (result.token?.trim()) {
          const bearerToken = result.token.startsWith("Bearer ")
            ? result.token
            : `Bearer ${result.token}`;

          if (isSecureAuthEnabled()) {
            const bootstrapped = await bootstrapSecureAuthSession(bearerToken);
            if (!bootstrapped) {
              throw new Error(
                "Unable to establish your secure session after verification.",
              );
            }
          }

          const signInResult = await signIn("auth-token", {
            token: bearerToken,
            redirect: false,
          });

          if (signInResult?.error) {
            throw new Error("Unable to create your session.");
          }
        }

        toast.success("Email verified successfully");
        router.replace("/dashboard");
      })
      .catch((error) => {
        captureFrontendException(error, {
          tags: {
            flow: "auth.verify_email_link",
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

  const handleVerifyOtp = async () => {
    if (!resolvedEmail) {
      toast.error("We could not determine which email to verify.");
      return;
    }

    if (otp.trim().length !== OTP_LENGTH) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }

    setIsVerifying(true);
    setStatusVariant("pending");
    try {
      const pendingRememberMe = getPendingRememberMePreference();
      const result = await verifyEmailVerificationOtp(
        resolvedEmail,
        otp.trim(),
        pendingRememberMe,
      );
      const bearerToken = result.token.startsWith("Bearer ")
        ? result.token
        : `Bearer ${result.token}`;

      if (isSecureAuthEnabled()) {
        const bootstrapped = await bootstrapSecureAuthSession(bearerToken, {
          rememberMe: pendingRememberMe,
        });
        if (!bootstrapped) {
          throw new Error("Unable to establish your secure session.");
        }
      }

      const signInResult = await signIn("auth-token", {
        token: bearerToken,
        redirect: false,
      });

      if (signInResult?.error) {
        throw new Error("Unable to create your session.");
      }

      setStatusVariant("success");
      setMessage("Email verified successfully. Redirecting you to your dashboard...");
      toast.success("Email verified successfully");
      router.replace("/dashboard");
    } catch (error) {
      captureFrontendException(error, {
        tags: {
          flow: "auth.verify_email_otp",
        },
      });
      setStatusVariant("error");
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to verify email.",
      );
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to verify email.",
      );
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!resolvedEmail) {
      toast.error("We could not determine which email to verify.");
      return;
    }

    setIsResending(true);
    try {
      const response = await resendEmailVerificationOtp(resolvedEmail);
      setRetryAfter(
        typeof response?.retryAfter === "number" && response.retryAfter > 0
          ? response.retryAfter
          : DEFAULT_RETRY_AFTER,
      );
      setExpiresIn(
        typeof response?.expiresIn === "number" && response.expiresIn > 0
          ? response.expiresIn
          : DEFAULT_EXPIRES_IN,
      );
      setStatusVariant("pending");
      setMessage("A fresh verification OTP is on the way. Please check your inbox.");
      toast.success("Verification OTP sent");
    } catch (error) {
      captureFrontendException(error, {
        tags: {
          flow: "auth.resend_verification_otp",
        },
      });
      setStatusVariant("error");
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to resend verification OTP right now.",
      );
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to resend verification OTP right now.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const canVerifyOtp =
    otp.trim().length === OTP_LENGTH && !isVerifying && Boolean(resolvedEmail);

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
        </div>

        {otpMode ? (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="verify-email-address"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <Input
                id="verify-email-address"
                value={resolvedEmail}
                readOnly
                placeholder="you@example.com"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="verify-email-otp"
                className="text-sm font-medium text-foreground"
              >
                OTP
              </label>
              <Input
                id="verify-email-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                }
                placeholder="Enter 6-digit OTP"
                className="text-center text-lg tracking-[0.35em]"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {retryAfter > 0
                  ? `Resend available in ${retryAfter}s`
                  : "You can request a new OTP now."}
              </span>
              <span>
                {expiresIn > 0
                  ? `OTP expires in ${Math.max(1, Math.ceil(expiresIn / 60))} minute(s)`
                  : "OTP expired. Request a new one."}
              </span>
            </div>

            <Button
              type="button"
              onClick={() => void handleVerifyOtp()}
              disabled={!canVerifyOtp}
            >
              {isVerifying ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify email"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void handleResendOtp()}
              disabled={isResending || retryAfter > 0 || !resolvedEmail}
            >
              {isResending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Sending OTP...
                </>
              ) : retryAfter > 0 ? (
                `Resend in ${retryAfter}s`
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" />
                  Resend OTP
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
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
          </div>
        )}

        <div className="mt-4">
          {status === "authenticated" ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Use another account</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to login</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;

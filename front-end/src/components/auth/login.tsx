"use client";

import React, {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { loginAction, workerLoginAction } from "@/actions/authActions";
import SubmitBtn from "@/components/common/SubmitBtn";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/providers/LanguageProvider";
import { useHydrated } from "@/hooks/useHydrated";
import {
  requestOtpLoginCode,
  requestPasskeyAuthenticationOptions,
  verifyOtpLoginCode,
  verifyPasskeyAuthentication,
} from "@/lib/authClient";
import { captureAnalyticsEvent } from "@/lib/observability/client";
import { captureFrontendException } from "@/lib/observability/shared";

type LoginProps = {
  mode?: "owner" | "worker";
};

const OTP_LENGTH = 6;

const normalizeToken = (rawToken: unknown) => {
  if (typeof rawToken !== "string") {
    return null;
  }

  const token = rawToken.trim();
  if (!token || token === "undefined" || token === "null") {
    return null;
  }

  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export default function Login({ mode = "owner" }: LoginProps) {
  const router = useRouter();
  const { t } = useI18n();
  const isWorkerMode = mode === "worker";
  const initialState = {
    message: "",
    status: 0,
    errors: {},
    data: {},
  };
  const [state, formAction] = useActionState(
    isWorkerMode ? workerLoginAction : loginAction,
    initialState,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpStarted, setOtpStarted] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array.from({ length: OTP_LENGTH }, () => ""),
  );
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastSubmittedOtpRef = useRef<string | null>(null);
  const hydrated = useHydrated();

  const supportsPasskeys = useMemo(
    () => hydrated && typeof window.PublicKeyCredential !== "undefined",
    [hydrated],
  );

  const callbackUrl = isWorkerMode ? "/sales" : "/dashboard";

  const completeTokenLogin = useCallback(
    async (rawToken: unknown) => {
      const token = normalizeToken(rawToken);
      if (!token) {
        toast.error("A valid login token was not returned.");
        return;
      }

      setIsSigningIn(true);
      try {
        const result = await signIn("auth-token", {
          token,
          redirect: false,
        });

        if (result?.error) {
          throw new Error("Unable to create your session.");
        }

        window.localStorage.setItem("token", token);
        router.push(callbackUrl);
        router.refresh();
      } catch (error) {
        captureFrontendException(error, {
          tags: {
            flow: "auth.complete_token_login",
            mode,
          },
        });
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Unable to complete sign in.";
        toast.error(message);
      } finally {
        setIsSigningIn(false);
      }
    },
    [callbackUrl, router],
  );

  useEffect(() => {
    if (state.status === 500) {
      captureAnalyticsEvent("auth_login_failed", {
        method: "password",
        mode,
        status: state.status,
      });
      toast.error(state.message);
    } else if (state.status === 422) {
      captureAnalyticsEvent("auth_login_failed", {
        method: "password",
        mode,
        status: state.status,
      });
      toast.error(state.message);
    } else if (state.status === 200) {
      captureAnalyticsEvent("auth_login_succeeded", {
        method: "password",
        mode,
      });
      toast.success(state.message);
      void completeTokenLogin(state.data?.token);
    }
  }, [completeTokenLogin, mode, state]);

  useEffect(() => {
    if (otpCooldown <= 0) return;

    const interval = window.setInterval(() => {
      setOtpCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [otpCooldown]);

  useEffect(() => {
    if (otpExpiresIn <= 0) return;

    const interval = window.setInterval(() => {
      setOtpExpiresIn((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [otpExpiresIn]);

  const handleGoogleLogin = () => {
    captureAnalyticsEvent("auth_login_started", {
      method: "google",
      mode,
    });
    signIn("google", { callbackUrl: "/dashboard", redirect: true });
  };

  const handlePasskeyLogin = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Enter your email first to continue with a passkey.");
      return;
    }

    if (!supportsPasskeys) {
      toast.error("Passkeys are not supported in this browser.");
      return;
    }

    setIsPasskeyLoading(true);
    captureAnalyticsEvent("auth_login_started", {
      method: "passkey",
      mode,
    });
    try {
      const optionsResponse =
        await requestPasskeyAuthenticationOptions<Record<string, unknown>>(
          normalizedEmail,
        );
      const browserResponse = await startAuthentication({
        optionsJSON: optionsResponse.options as unknown as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });

      const authPayload = await verifyPasskeyAuthentication(
        normalizedEmail,
        optionsResponse.challenge_id,
        browserResponse,
      );

      toast.success("Passkey verified.");
      captureAnalyticsEvent("auth_login_succeeded", {
        method: "passkey",
        mode,
      });
      await completeTokenLogin(authPayload.token);
    } catch (error) {
      captureAnalyticsEvent("auth_login_failed", {
        method: "passkey",
        mode,
      });
      captureFrontendException(error, {
        tags: {
          flow: "auth.passkey_login",
          mode,
        },
      });
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to continue with passkey.";
      toast.error(message);
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const focusOtpInput = (index: number) => {
    otpInputRefs.current[index]?.focus();
    otpInputRefs.current[index]?.select();
  };

  const handleSendOtp = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      toast.error("Enter your email first to receive a login code.");
      return;
    }

    setIsOtpSending(true);
    captureAnalyticsEvent("auth_login_otp_requested", {
      mode,
    });
    try {
      const response = await requestOtpLoginCode(normalizedEmail);
      setOtpStarted(true);
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setOtpCooldown(response.retryAfter ?? 60);
      setOtpExpiresIn(response.expiresIn ?? 300);
      lastSubmittedOtpRef.current = null;
      captureAnalyticsEvent("auth_login_otp_sent", {
        mode,
      });
      toast.success("Login code sent to your email.");
      window.setTimeout(() => focusOtpInput(0), 60);
    } catch (error) {
      captureAnalyticsEvent("auth_login_otp_failed", {
        mode,
      });
      captureFrontendException(error, {
        tags: {
          flow: "auth.otp_request",
          mode,
        },
      });
      if (
        error instanceof Error &&
        "retryAfter" in error &&
        typeof error.retryAfter === "number" &&
        error.retryAfter > 0
      ) {
        setOtpStarted(true);
        setOtpCooldown(error.retryAfter);
      }
      if (
        error instanceof Error &&
        "expiresIn" in error &&
        typeof error.expiresIn === "number" &&
        error.expiresIn > 0
      ) {
        setOtpExpiresIn(error.expiresIn);
      }
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to send login code.";
      toast.error(message);
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyOtp = useCallback(
    async (codeOverride?: string) => {
      const normalizedEmail = normalizeEmail(email);
      const code = (codeOverride ?? otpDigits.join("")).trim();

      if (!normalizedEmail) {
        toast.error("Enter your email first.");
        return;
      }

      if (code.length !== OTP_LENGTH) {
        toast.error("Enter the 6-digit code.");
        return;
      }

      if (lastSubmittedOtpRef.current === code && isOtpVerifying) {
        return;
      }

      lastSubmittedOtpRef.current = code;
      setIsOtpVerifying(true);
      try {
        const authPayload = await verifyOtpLoginCode(normalizedEmail, code);
        toast.success("OTP verified.");
        captureAnalyticsEvent("auth_login_succeeded", {
          method: "otp",
          mode,
        });
        await completeTokenLogin(authPayload.token);
      } catch (error) {
        captureAnalyticsEvent("auth_login_failed", {
          method: "otp",
          mode,
        });
        captureFrontendException(error, {
          tags: {
            flow: "auth.otp_verify",
            mode,
          },
        });
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Unable to verify the login code.";
        lastSubmittedOtpRef.current = null;
        setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
        toast.error(message);
        window.setTimeout(() => focusOtpInput(0), 60);
      } finally {
        setIsOtpVerifying(false);
      }
    },
    [completeTokenLogin, email, otpDigits],
  );

  useEffect(() => {
    const code = otpDigits.join("");
    if (
      code.length === OTP_LENGTH &&
      !otpDigits.includes("") &&
      !isOtpVerifying
    ) {
      void handleVerifyOtp(code);
    }
  }, [handleVerifyOtp, isOtpVerifying, otpDigits]);

  const updateOtpDigit = (index: number, value: string) => {
    const nextValue = value.replace(/\D/g, "");
    if (!nextValue) {
      setOtpDigits((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }

    setOtpDigits((current) => {
      const next = [...current];
      const chars = nextValue.slice(0, OTP_LENGTH - index).split("");

      chars.forEach((char, offset) => {
        next[index + offset] = char;
      });

      return next;
    });

    const nextIndex = Math.min(index + nextValue.length, OTP_LENGTH - 1);
    window.setTimeout(() => focusOtpInput(nextIndex), 0);
  };

  const handleOtpKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      focusOtpInput(index - 1);
    }
  };

  return (
    <>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("auth.loginForm.emailLabel")}</Label>
          <Input
            id="email"
            placeholder={t("auth.loginForm.emailPlaceholder")}
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <span className="text-xs text-destructive">
            {state.errors?.email}
          </span>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              {t("auth.loginForm.passwordLabel")}
            </Label>
            {!isWorkerMode ? (
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {t("auth.loginForm.forgotPassword")}
              </Link>
            ) : null}
          </div>
          <Input
            id="password"
            type="password"
            placeholder={t("auth.loginForm.passwordPlaceholder")}
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              isWorkerMode ? "current-password" : "current-password"
            }
          />
          <span className="text-xs text-destructive">
            {state.errors?.password}
          </span>
        </div>
        <SubmitBtn />
      </form>

      {!isWorkerMode ? (
        <div className="mt-6 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t("auth.loginForm.continueWith")}
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex items-center justify-center gap-3 border-border bg-card hover:bg-accent"
              onClick={handlePasskeyLogin}
              disabled={isPasskeyLoading || isSigningIn}
            >
              {isPasskeyLoading
                ? "Checking passkey..."
                : "Continue with passkey"}
            </Button>

            <div className="rounded-2xl border border-border bg-muted/35 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Login with email code
                  </p>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll send a 6-digit OTP to your email address.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-card hover:bg-accent"
                  onClick={handleSendOtp}
                  disabled={
                    isOtpSending ||
                    isOtpVerifying ||
                    isSigningIn ||
                    otpCooldown > 0
                  }
                >
                  {isOtpSending
                    ? "Sending..."
                    : otpStarted
                      ? otpCooldown > 0
                        ? `Resend in ${otpCooldown}s`
                        : "Resend code"
                      : "Send code"}
                </Button>
              </div>

              {otpStarted ? (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    {otpDigits.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(element) => {
                          otpInputRefs.current[index] = element;
                        }}
                        value={digit}
                        onChange={(event) =>
                          updateOtpDigit(index, event.target.value)
                        }
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        className="h-12 w-11 text-center text-lg"
                        aria-label={`OTP digit ${index + 1}`}
                        disabled={isOtpVerifying || isSigningIn}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => void handleVerifyOtp()}
                      disabled={
                        isOtpVerifying ||
                        isSigningIn ||
                        otpDigits.join("").length !== OTP_LENGTH ||
                        otpDigits.includes("")
                      }
                    >
                      {isOtpVerifying ? "Verifying..." : "Verify code"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {otpCooldown > 0
                        ? `You can request a new code in ${otpCooldown}s.`
                        : "You can request a fresh code now."}
                    </span>
                    {otpExpiresIn > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {`Code expires in ${Math.max(1, Math.ceil(otpExpiresIn / 60))} minute(s).`}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              className="flex items-center justify-center gap-3 border-border bg-card hover:bg-accent"
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
            >
              <Image
                src="/images/google.png"
                alt={t("auth.loginForm.googleLogoAlt")}
                width={18}
                height={18}
              />
              {t("auth.loginForm.google")}
            </Button>

            {!supportsPasskeys ? (
              <p className="text-xs text-muted-foreground">
                This browser does not support passkeys, so OTP and password
                login remain available.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import React, {
  FormEvent,
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { loginAction, workerLoginAction } from "@/actions/authActions";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/providers/LanguageProvider";
import { useHydrated } from "@/hooks/useHydrated";
import AuthFormField from "@/components/auth/AuthFormField";
import FaceLoginModal from "./FaceLoginModal";
import {
  requestOtpLoginCode,
  requestPasskeyAuthenticationOptions,
  verifyOtpLoginCode,
  verifyPasskeyAuthentication,
} from "@/lib/authClient";
import { captureAnalyticsEvent } from "@/lib/observability/client";
import { captureFrontendException } from "@/lib/observability/shared";
import { Eye, EyeOff, LoaderCircle, Camera } from "lucide-react";

type LoginProps = {
  mode?: "owner" | "worker";
  autoFocusFirstField?: boolean;
};

const OTP_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;

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
const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

const isEmail = (value: string) => EMAIL_REGEX.test(value);
const isIndianPhone = (value: string) => INDIAN_PHONE_REGEX.test(value);

const asErrorText = (value: unknown) => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
};

const validateIdentifier = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your email or phone number.";
  }

  const phoneCandidate = normalizePhone(trimmed);
  if (isEmail(trimmed) || isIndianPhone(phoneCandidate)) {
    return "";
  }

  return "Enter a valid email or Indian phone number.";
};

const validatePassword = (value: string) => {
  if (!value.trim()) {
    return "Enter your password.";
  }

  return "";
};

export default function Login({
  mode = "owner",
  autoFocusFirstField = false,
}: LoginProps) {
  const router = useRouter();
  const { t } = useI18n();
  const isWorkerMode = mode === "worker";
  const initialState = {
    message: "",
    status: 0,
    errors: {},
    data: {},
  };
  const [state, formAction, isCredentialSubmitting] = useActionState(
    isWorkerMode ? workerLoginAction : loginAction,
    initialState,
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});
  const [touched, setTouched] = useState<{
    identifier: boolean;
    password: boolean;
  }>({
    identifier: false,
    password: false,
  });
  const [isFaceLoginOpen, setIsFaceLoginOpen] = useState(false);
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
    [callbackUrl, mode, router],
  );

  const identifierServerError = asErrorText(
    state.errors?.identifier ?? state.errors?.email,
  );
  const passwordServerError = asErrorText(state.errors?.password);

  const identifierError = fieldErrors.identifier || identifierServerError;
  const passwordError = fieldErrors.password || passwordServerError;

  const handleIdentifierChange = (value: string) => {
    setIdentifier(value);
    if (touched.identifier) {
      setFieldErrors((current) => ({
        ...current,
        identifier: validateIdentifier(value),
      }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (touched.password) {
      setFieldErrors((current) => ({
        ...current,
        password: validatePassword(value),
      }));
    }
  };

  const handleIdentifierBlur = () => {
    setTouched((current) => ({ ...current, identifier: true }));
    setFieldErrors((current) => ({
      ...current,
      identifier: validateIdentifier(identifier),
    }));
  };

  const handlePasswordBlur = () => {
    setTouched((current) => ({ ...current, password: true }));
    setFieldErrors((current) => ({
      ...current,
      password: validatePassword(password),
    }));
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    setTouched({ identifier: true, password: true });

    const nextErrors = {
      identifier: validateIdentifier(identifier),
      password: validatePassword(password),
    };

    setFieldErrors(nextErrors);

    if (nextErrors.identifier || nextErrors.password) {
      event.preventDefault();
      return;
    }

    captureAnalyticsEvent("auth_login_started", {
      method: "password",
      mode,
    });
  };

  useEffect(() => {
    if (state.status >= 400) {
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
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !isEmail(normalizedIdentifier)) {
      toast.error("Enter a valid email first to continue with a passkey.");
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
          normalizeEmail(normalizedIdentifier),
        );
      const browserResponse = await startAuthentication({
        optionsJSON: optionsResponse.options as unknown as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });

      const authPayload = await verifyPasskeyAuthentication(
        normalizeEmail(normalizedIdentifier),
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
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !isEmail(normalizedIdentifier)) {
      toast.error("Enter a valid email first to receive a login code.");
      return;
    }

    const normalizedEmail = normalizeEmail(normalizedIdentifier);

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
      const normalizedIdentifier = identifier.trim();
      const normalizedEmail = normalizeEmail(normalizedIdentifier);
      const code = (codeOverride ?? otpDigits.join("")).trim();

      if (!normalizedIdentifier || !isEmail(normalizedIdentifier)) {
        toast.error("Enter a valid email first.");
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
    [completeTokenLogin, identifier, isOtpVerifying, mode, otpDigits],
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
      <form
        action={formAction}
        className="grid gap-4"
        noValidate
        onSubmit={handlePasswordSubmit}
      >
        <AuthFormField
          id="identifier"
          name="identifier"
          label={t("auth.shared.emailOrPhoneLabel")}
          placeholder={t("auth.shared.emailOrPhonePlaceholder")}
          value={identifier}
          onChange={handleIdentifierChange}
          onBlur={handleIdentifierBlur}
          autoComplete="username"
          autoFocus={autoFocusFirstField}
          error={identifierError}
          disabled={isCredentialSubmitting || isSigningIn}
        />
        <div className="flex items-center justify-end">
          {!isWorkerMode ? (
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              {t("auth.loginForm.forgotPassword")}
            </Link>
          ) : null}
        </div>
        <AuthFormField
          id="password"
          name="password"
          label={t("auth.loginForm.passwordLabel")}
          type={showPassword ? "text" : "password"}
          placeholder={t("auth.loginForm.passwordPlaceholder")}
          value={password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          autoComplete="current-password"
          error={passwordError}
          disabled={isCredentialSubmitting || isSigningIn}
          rightAdornment={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? t("common.hide") : t("common.show")}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          }
        />
        <Button
          type="submit"
          className="mt-2 w-full"
          disabled={isCredentialSubmitting || isSigningIn}
        >
          {isCredentialSubmitting || isSigningIn ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {t("auth.shared.signingIn")}
            </>
          ) : (
            t("auth.shared.loginTab")
          )}
        </Button>
      </form>

      <FaceLoginModal 
        isOpen={isFaceLoginOpen} 
        onClose={() => setIsFaceLoginOpen(false)} 
        onSuccess={(auth) => {
          void completeTokenLogin(auth.token);
        }}
        email={identifier}
      />

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

            <Button
              type="button"
              variant="outline"
              className="flex items-center justify-center gap-3 border-border bg-card hover:bg-accent"
              onClick={() => setIsFaceLoginOpen(true)}
              disabled={isSigningIn}
            >
              <Camera className="w-4 h-4" />
              Continue with Face
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

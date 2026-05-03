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
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import {
  requestOtpLoginCode,
  requestPasskeyAuthenticationOptions,
  verifyOtpLoginCode,
  verifyPasskeyAuthentication,
} from "@/lib/authClient";
import {
  bootstrapSecureAuthSession,
  clearAuthLoginInProgress,
  getAuthTokenExpiry,
  isSecureAuthEnabled,
  logClientAuthEvent,
  markAuthLoginInProgress,
  setLegacyStoredToken,
  setPendingRememberMePreference,
} from "@/lib/secureAuth";
import { captureAnalyticsEvent } from "@/lib/observability/client";
import { captureFrontendException } from "@/lib/observability/shared";
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Smartphone,
} from "lucide-react";

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
  const [rememberMe, setRememberMe] = useState(false);
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
  const loginCompletionRef = useRef<Promise<boolean> | null>(null);
  const handledLoginTokenRef = useRef<string | null>(null);
  const hydrated = useHydrated();

  const supportsPasskeys = useMemo(
    () => hydrated && typeof window.PublicKeyCredential !== "undefined",
    [hydrated],
  );

  const callbackUrl = isWorkerMode ? "/worker-panel" : "/dashboard";
  const verificationRedirectData =
    state.data && typeof state.data === "object" && "code" in state.data
      ? (state.data as {
          code?: string | null;
          email?: string | null;
          retryAfter?: number | null;
          expiresIn?: number | null;
        })
      : null;

  const completeTokenLogin = useCallback(
    async (
      rawToken: unknown,
      options?: {
        isEmailVerified?: boolean | null;
        rememberMe?: boolean | null;
      },
    ) => {
      const token = normalizeToken(rawToken);
      if (!token) {
        toast.error("A valid login token was not returned.");
        return false;
      }

      if (loginCompletionRef.current) {
        return loginCompletionRef.current;
      }

      loginCompletionRef.current = (async () => {
        setIsSigningIn(true);
        markAuthLoginInProgress();
        setLegacyStoredToken(token);
        logClientAuthEvent("login_token_received", {
          mode,
          callbackUrl,
          secureAuthEnabled: isSecureAuthEnabled(),
          rememberMe: options?.rememberMe ?? null,
          expiresAt: getAuthTokenExpiry(token),
        });

        const secureAuthEnabled = isSecureAuthEnabled();
        const bootstrapped = await bootstrapSecureAuthSession(token, {
          rememberMe:
            typeof options?.rememberMe === "boolean"
              ? options.rememberMe
              : undefined,
          allowWhenSecureAuthDisabled: true,
        });

        if (secureAuthEnabled) {
          if (!bootstrapped) {
            throw new Error("Unable to establish your secure session.");
          }

          logClientAuthEvent("secure_session_bootstrapped", {
            mode,
            callbackUrl,
          });
        } else {
          logClientAuthEvent("refresh_session_bootstrap_completed", {
            mode,
            callbackUrl,
            bootstrapped,
          });
        }

        const result = await signIn("auth-token", {
          token,
          redirect: false,
        });

        if (result?.error) {
          throw new Error("Unable to create your session.");
        }

        logClientAuthEvent("nextauth_session_created", {
          mode,
          callbackUrl,
        });
        clearAuthLoginInProgress();

        const destination =
          !isWorkerMode && options?.isEmailVerified === false
            ? "/verify-email"
            : callbackUrl;

        logClientAuthEvent("login_redirecting", {
          destination,
          mode,
        });
        router.replace(destination);
        return true;
      })();

      try {
        const completed = await loginCompletionRef.current;
        if (!completed) {
          loginCompletionRef.current = null;
        }
        return completed;
      } catch (error) {
        loginCompletionRef.current = null;
        clearAuthLoginInProgress();
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
        return false;
      } finally {
        if (!loginCompletionRef.current) {
          setIsSigningIn(false);
        }
      }
    },
    [callbackUrl, isWorkerMode, mode, router],
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
    if (
      state.status === 403 &&
      verificationRedirectData?.code === "EMAIL_VERIFICATION_REQUIRED"
    ) {
      setPendingRememberMePreference(rememberMe);
      captureAnalyticsEvent("auth_login_verification_required", {
        method: "password",
        mode,
      });
      toast.error(state.message || "Please verify your email first");
      const verificationEmail =
        typeof verificationRedirectData?.email === "string" &&
        verificationRedirectData.email.trim()
          ? verificationRedirectData.email.trim()
          : identifier.trim();
      const nextSearchParams = new URLSearchParams({
        email: verificationEmail,
      });
      if (typeof verificationRedirectData?.retryAfter === "number") {
        nextSearchParams.set(
          "retryAfter",
          String(verificationRedirectData.retryAfter),
        );
      }
      if (typeof verificationRedirectData?.expiresIn === "number") {
        nextSearchParams.set(
          "expiresIn",
          String(verificationRedirectData.expiresIn),
        );
      }
      router.push(`/verify-email?${nextSearchParams.toString()}`);
    } else if (state.status >= 400) {
      captureAnalyticsEvent("auth_login_failed", {
        method: "password",
        mode,
        status: state.status,
      });
      toast.error(state.message);
    } else if (state.status === 200) {
      const loginToken = normalizeToken(state.data?.token);
      if (loginToken && handledLoginTokenRef.current === loginToken) {
        return;
      }

      if (loginToken) {
        handledLoginTokenRef.current = loginToken;
      }

      captureAnalyticsEvent("auth_login_succeeded", {
        method: "password",
        mode,
      });
      toast.success(state.message);
      void completeTokenLogin(loginToken, {
        isEmailVerified:
          typeof state.data?.user?.is_email_verified === "boolean"
            ? state.data.user.is_email_verified
            : null,
        rememberMe:
          typeof state.data?.rememberMe === "boolean"
            ? state.data.rememberMe
            : rememberMe,
      }).then((completed) => {
        if (!completed && loginToken && handledLoginTokenRef.current === loginToken) {
          handledLoginTokenRef.current = null;
        }
      });
    }
  }, [
    completeTokenLogin,
    identifier,
    mode,
    rememberMe,
    router,
    state,
    verificationRedirectData,
  ]);

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
    setPendingRememberMePreference(rememberMe);
    markAuthLoginInProgress();
    captureAnalyticsEvent("auth_login_started", {
      method: "google",
      mode,
    });
    void signIn("google", {
      callbackUrl: "/auth/google-complete?next=/dashboard",
      redirect: true,
    });
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
        rememberMe,
      );

      toast.success("Passkey verified.");
      captureAnalyticsEvent("auth_login_succeeded", {
        method: "passkey",
        mode,
      });
      await completeTokenLogin(authPayload.token, {
        isEmailVerified:
          typeof authPayload.user?.is_email_verified === "boolean"
            ? authPayload.user.is_email_verified
            : null,
        rememberMe,
      });
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
        const authPayload = await verifyOtpLoginCode(
          normalizedEmail,
          code,
          rememberMe,
        );
        toast.success("OTP verified.");
        captureAnalyticsEvent("auth_login_succeeded", {
          method: "otp",
          mode,
        });
        await completeTokenLogin(authPayload.token, {
          isEmailVerified:
            typeof authPayload.user?.is_email_verified === "boolean"
              ? authPayload.user.is_email_verified
              : null,
          rememberMe,
        });
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
    [completeTokenLogin, identifier, isOtpVerifying, mode, otpDigits, rememberMe],
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
        className="grid gap-4 rounded-[1.75rem] border border-white/75 bg-white/90 p-4 shadow-[0_20px_52px_-42px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-white/[0.07] sm:p-5"
        noValidate
        onSubmit={handlePasswordSubmit}
      >
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/[0.04] px-4 py-3 dark:border-primary/15 dark:bg-primary/[0.08]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
              {isWorkerMode ? "Team access" : "Secure login"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isWorkerMode
                ? "Use your assigned credentials to continue to the worker workspace."
                : "Password, OTP, passkey, and face login all stay available."}
            </p>
          </div>
          <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <input
          type="hidden"
          name="rememberMe"
          value={rememberMe ? "true" : "false"}
        />
        <AuthFormField
          id="identifier"
          name={isWorkerMode ? "identifier" : "email"}
          label={t("auth.shared.emailOrPhoneLabel")}
          placeholder={t("auth.shared.emailOrPhonePlaceholder")}
          value={identifier}
          onChange={handleIdentifierChange}
          onBlur={handleIdentifierBlur}
          autoComplete="username"
          autoFocus={autoFocusFirstField}
          error={identifierError}
          disabled={isCredentialSubmitting || isSigningIn}
          leftAdornment={
            identifier.includes("@") ? (
              <Mail className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )
          }
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
        <label className="flex items-center gap-3 rounded-2xl border border-white/60 bg-slate-950/[0.03] px-3.5 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>
            {rememberMe
              ? "Keep me logged in for 7 days"
              : "Keep me logged in for 1 day"}
          </span>
        </label>
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
          leftAdornment={<LockKeyhole className="h-4 w-4" />}
          rightAdornment={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 rounded-full"
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
          className="mt-2 h-12 w-full rounded-2xl shadow-[0_24px_45px_-26px_rgba(2,132,199,0.58)] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
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

        <div aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
          {state.status >= 400 && state.message ? state.message : null}
        </div>
      </form>

      <ErrorBoundary
        fallback={
          isFaceLoginOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <p className="text-sm text-red-600">
                  Face system error. Try again.
                </p>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  onClick={() => setIsFaceLoginOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        <FaceLoginModal
          isOpen={isFaceLoginOpen}
          onClose={() => setIsFaceLoginOpen(false)}
          rememberMe={rememberMe}
          onSuccess={async (auth) => {
            const completed = await completeTokenLogin(auth.token, {
              isEmailVerified:
                typeof auth.user?.is_email_verified === "boolean"
                  ? auth.user.is_email_verified
                  : null,
              rememberMe,
            });
            if (completed) {
              setIsFaceLoginOpen(false);
            }
            return completed;
          }}
          email={identifier}
        />
      </ErrorBoundary>

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
              className="h-12 justify-center gap-3 rounded-2xl border-white/75 bg-white/90 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/10"
              onClick={handlePasskeyLogin}
              disabled={isPasskeyLoading || isSigningIn}
            >
              <KeyRound className="h-4 w-4" />
              {isPasskeyLoading
                ? "Checking passkey..."
                : "Continue with passkey"}
            </Button>

            <div className="rounded-[1.6rem] border border-white/75 bg-white/95 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.26)] dark:border-white/10 dark:bg-white/[0.07]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Login with email code
                  </p>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll send a 6-digit OTP to your email address.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-white/75 bg-white/90 font-semibold shadow-[0_12px_24px_-22px_rgba(15,23,42,0.26)] dark:border-white/10 dark:bg-white/10"
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
                        className="h-12 w-11 rounded-2xl border-white/75 bg-white/95 text-center text-lg font-semibold text-slate-950 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-white/10 dark:text-white"
                        aria-label={`OTP digit ${index + 1}`}
                        disabled={isOtpVerifying || isSigningIn}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      className="rounded-2xl"
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
              className="h-12 justify-center gap-3 rounded-2xl border-white/75 bg-white/90 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/10"
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
              className="h-12 justify-center gap-3 rounded-2xl border-white/75 bg-white/90 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/10"
              onClick={() => setIsFaceLoginOpen(true)}
              disabled={isSigningIn}
            >
              <Camera className="h-4 w-4" />
              Continue with Face
            </Button>

            {!supportsPasskeys ? (
              <p className="rounded-2xl border border-dashed border-white/70 bg-white/60 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
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

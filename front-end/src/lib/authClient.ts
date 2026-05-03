import axios from "axios";
import { API_URL } from "./apiEndPoints";
import { apiClient } from "./apiClient";
import {
  buildCsrfHeadersIfAvailable,
  buildRequiredCsrfHeaders,
} from "./csrfClient";

axios.defaults.withCredentials = true;

export type AuthSuccessPayload = {
  user: {
    id: number | string;
    name: string;
    email: string;
    provider?: string | null;
    image?: string | null;
    is_email_verified?: boolean;
    role?: "ADMIN" | "WORKER";
    workerRole?: "ADMIN" | "WORKER";
    worker_role?: "ADMIN" | "WORKER";
    businessId?: string | null;
    accountType?: "OWNER" | "WORKER";
    workerId?: string | null;
    ownerUserId?: number | null;
  };
  token: string;
};

export type EmailVerificationResult = AuthSuccessPayload & {
  expiresAt?: number;
};

export type EmailVerificationOtpResponse = AuthSuccessPayload & {
  expiresAt?: number;
};

export type PasskeyCredentialRecord = {
  id: number;
  label: string;
  device_type: string;
  backed_up: boolean;
  created_at: string;
  last_used_at?: string | null;
};

export type PasskeyOptionsResponse<TOptions> = {
  challenge_id: number;
  options: TOptions;
  label?: string;
};

type RetryableError = Error & {
  retryAfter?: number;
  expiresIn?: number;
};

const createBrowserRequestConfig = async () => ({
  withCredentials: true,
  headers: await buildRequiredCsrfHeaders(),
});

const createOptionalBrowserRequestConfig = () => ({
  withCredentials: true,
  headers: buildCsrfHeadersIfAvailable(),
});

const extractMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { message?: string; code?: string }
      | undefined;
    const message = payload?.message;
    const code = payload?.code;
    if (typeof code === "string" && code.startsWith("CSRF_")) {
      return "Security check expired. Please try again.";
    }
    if (message?.trim()) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

export const requestOtpLoginCode = async (email: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/auth/otp/send`,
      { email },
      await createBrowserRequestConfig(),
    );
    return response.data.data as { retryAfter: number; expiresIn: number };
  } catch (error) {
    const nextError = new Error(
      extractMessage(error, "Unable to send login code."),
    ) as RetryableError;

    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { data?: { retryAfter?: number; expiresIn?: number } }
        | undefined;
      nextError.retryAfter = data?.data?.retryAfter;
      nextError.expiresIn = data?.data?.expiresIn;
    }

    throw nextError;
  }
};

export const verifyOtpLoginCode = async (
  email: string,
  code: string,
  rememberMe = false,
) => {
  try {
    const response = await axios.post(`${API_URL}/auth/otp/verify`, {
      email,
      code,
      rememberMe,
    }, await createBrowserRequestConfig());
    return (response.data.data ?? response.data) as AuthSuccessPayload;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to verify login code."));
  }
};

export const requestPasskeyAuthenticationOptions = async <TOptions>(
  email: string,
) => {
  try {
    const response = await axios.post(
      `${API_URL}/auth/passkeys/authenticate/options`,
      { email },
      await createBrowserRequestConfig(),
    );
    return response.data.data as PasskeyOptionsResponse<TOptions>;
  } catch (error) {
    throw new Error(
      extractMessage(error, "Unable to start passkey authentication."),
    );
  }
};

export const verifyPasskeyAuthentication = async (
  email: string,
  challengeId: number,
  responsePayload: unknown,
  rememberMe = false,
) => {
  try {
    const response = await axios.post(
      `${API_URL}/auth/passkeys/authenticate/verify`,
      {
        email,
        challenge_id: challengeId,
        rememberMe,
        response: responsePayload,
      },
      await createBrowserRequestConfig(),
    );
    return (response.data.data ?? response.data) as AuthSuccessPayload;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to verify passkey login."));
  }
};

export const fetchPasskeys = async () => {
  try {
    const response = await apiClient.get("/auth/passkeys");
    return response.data.data as PasskeyCredentialRecord[];
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to load passkeys."));
  }
};

export const requestPasskeyRegistrationOptions = async <TOptions>(
  label?: string,
) => {
  try {
    const response = await apiClient.post("/auth/passkeys/register/options", {
      label,
    });
    return response.data.data as PasskeyOptionsResponse<TOptions>;
  } catch (error) {
    throw new Error(
      extractMessage(error, "Unable to start passkey registration."),
    );
  }
};

export const verifyPasskeyRegistration = async (
  challengeId: number,
  responsePayload: unknown,
  label?: string,
) => {
  try {
    const response = await apiClient.post("/auth/passkeys/register/verify", {
      challenge_id: challengeId,
      label,
      response: responsePayload,
    });
    return response.data.data as PasskeyCredentialRecord;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to save this passkey."));
  }
};

export const removePasskey = async (id: number) => {
  try {
    await apiClient.delete(`/auth/passkeys/${id}`);
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to remove passkey."));
  }
};

export const verifyEmailAddress = async (token: string) => {
  try {
    const response = await axios.get(`${API_URL}/auth/verify-email`, {
      params: { token },
      ...createOptionalBrowserRequestConfig(),
    });
    return (response.data.data ?? response.data) as EmailVerificationResult;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to verify email."));
  }
};

export const verifyEmailVerificationOtp = async (
  email: string,
  otp: string,
  rememberMe?: boolean | null,
) => {
  try {
    const response = await axios.post(
      `${API_URL}/auth/verify-email`,
      {
        email,
        otp,
        rememberMe:
          typeof rememberMe === "boolean" ? rememberMe : undefined,
      },
      await createBrowserRequestConfig(),
    );
    return (response.data.data ?? response.data) as EmailVerificationOtpResponse;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to verify email."));
  }
};

export const resendEmailVerificationOtp = async (email: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/auth/resend-otp`,
      { email },
      await createBrowserRequestConfig(),
    );
    return response.data.data as
      | { email?: string; retryAfter?: number; expiresIn?: number }
      | undefined;
  } catch (error) {
    const nextError = new Error(
      extractMessage(error, "Unable to resend verification code."),
    ) as RetryableError;

    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { data?: { retryAfter?: number; expiresIn?: number } }
        | undefined;
      nextError.retryAfter = data?.data?.retryAfter;
      nextError.expiresIn = data?.data?.expiresIn;
    }

    throw nextError;
  }
};

export const resendVerificationEmail = async () => {
  try {
    const response = await apiClient.post("/auth/resend-verification");
    return response.data.data as { retryAfter?: number } | undefined;
  } catch (error) {
    const nextError = new Error(
      extractMessage(error, "Unable to resend verification email."),
    ) as RetryableError;

    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { data?: { retryAfter?: number } }
        | undefined;
      nextError.retryAfter = data?.data?.retryAfter;
    }

    throw nextError;
  }
};

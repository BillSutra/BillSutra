import axios from "axios";
import { API_URL } from "./apiEndPoints";
import { apiClient } from "./apiClient";

export type AuthSuccessPayload = {
  user: {
    id: number | string;
    name: string;
    email: string;
    provider?: string | null;
    image?: string | null;
    is_email_verified?: boolean;
    role?: "ADMIN" | "WORKER";
    businessId?: string | null;
    accountType?: "OWNER" | "WORKER";
    workerId?: string | null;
    ownerUserId?: number | null;
  };
  token: string;
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

const extractMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
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
    const response = await axios.post(`${API_URL}/auth/otp/send`, { email });
    return response.data.data as { retryAfter: number };
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to send login code."));
  }
};

export const verifyOtpLoginCode = async (email: string, code: string) => {
  try {
    const response = await axios.post(`${API_URL}/auth/otp/verify`, {
      email,
      code,
    });
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
) => {
  try {
    const response = await axios.post(
      `${API_URL}/auth/passkeys/authenticate/verify`,
      {
        email,
        challenge_id: challengeId,
        response: responsePayload,
      },
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

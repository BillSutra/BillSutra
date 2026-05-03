"use server";

import {
  check_credential,
  forgetPassword,
  REGISTER_URL,
  WORKER_LOGIN_URL,
} from "@/lib/apiEndPoints";
import axios, { AxiosError } from "axios";
import { resetPassword } from "../lib/apiEndPoints";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_EMAIL_REGEX =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const FULL_NAME_REGEX = /^[A-Za-z ]{2,50}$/;
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9\s]/;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "yopmail.com",
]);
const ALLOWED_SIGNUP_TLDS = new Set([
  "com",
  "in",
  "co",
  "org",
  "net",
  "io",
  "ai",
  "app",
  "dev",
  "info",
  "biz",
  "me",
  "edu",
  "gov",
  "us",
  "uk",
  "ca",
  "au",
  "sg",
  "ae",
]);
const COMMON_BREACHED_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "admin",
  "admin123",
  "bill1234",
  "billsutra",
  "letmein",
  "welcome",
  "welcome123",
  "iloveyou",
  "111111",
  "000000",
]);
const AUTH_REQUEST_CONFIG = {
  withCredentials: true,
} as const;

const normalizeIdentifier = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeSignupName = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const normalizeIndianPhone = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
};

const getEmailDomain = (value: string) => value.split("@")[1] ?? "";
const getEmailTld = (value: string) => {
  const domain = getEmailDomain(value);
  const parts = domain.split(".");
  return parts[parts.length - 1] ?? "";
};

const isCommonBreachedPassword = (value: string) =>
  COMMON_BREACHED_PASSWORDS.has(value.toLowerCase().replace(/\s+/g, ""));

const validateSignupPayload = (payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
}) => {
  const errors: Partial<
    Record<"name" | "email" | "phone" | "password" | "confirm_password", string>
  > = {};

  if (!payload.name) {
    errors.name = "Name is required";
  } else if (/\d/.test(payload.name)) {
    errors.name = "Name cannot contain numbers";
  } else if (!FULL_NAME_REGEX.test(payload.name) || !/[A-Za-z]/.test(payload.name)) {
    errors.name = "Enter valid full name";
  }

  const domain = getEmailDomain(payload.email);
  const tld = getEmailTld(payload.email);
  if (
    !payload.email ||
    payload.email.length > 100 ||
    !SIGNUP_EMAIL_REGEX.test(payload.email) ||
    DISPOSABLE_EMAIL_DOMAINS.has(domain) ||
    !ALLOWED_SIGNUP_TLDS.has(tld)
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (!INDIAN_PHONE_REGEX.test(payload.phone)) {
    errors.phone = "Enter a valid 10-digit mobile number.";
  }

  if (
    !payload.password ||
    payload.password.length < 8 ||
    payload.password.length > 64 ||
    !/[A-Z]/.test(payload.password) ||
    !/[a-z]/.test(payload.password) ||
    !/\d/.test(payload.password) ||
    !SPECIAL_CHARACTER_REGEX.test(payload.password) ||
    /\s/.test(payload.password) ||
    isCommonBreachedPassword(payload.password)
  ) {
    errors.password = "Use a stronger password.";
  }

  if (!payload.confirm_password) {
    errors.confirm_password = "Confirm your password.";
  } else if (payload.password !== payload.confirm_password) {
    errors.confirm_password = "Passwords do not match.";
  }

  return errors;
};

const extractAxiosMessage = (error: AxiosError, fallback: string) => {
  const responseMessage = (error.response?.data as { message?: unknown })
    ?.message;
  const responseError = (error.response?.data as { error?: unknown })?.error;

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (typeof responseError === "string" && responseError.trim()) {
    return responseError;
  }

  return fallback;
};

const extractAxiosErrors = (error: AxiosError) => {
  const data = error.response?.data as {
    errors?: unknown;
    details?: { errors?: unknown };
    data?: { errors?: unknown };
  };

  if (data?.errors && typeof data.errors === "object") {
    return data.errors;
  }

  if (data?.details?.errors && typeof data.details.errors === "object") {
    return data.details.errors;
  }

  if (data?.data?.errors && typeof data.data.errors === "object") {
    return data.data.errors;
  }

  return {};
};

export async function registerAction(prevState: unknown, formdata: FormData) {
  try {
    const name = normalizeSignupName(formdata.get("name"));
    const email = normalizeIdentifier(formdata.get("email")).toLowerCase();
    const phone = normalizeIndianPhone(formdata.get("phone"));
    const password =
      typeof formdata.get("password") === "string"
        ? String(formdata.get("password"))
        : "";
    const confirm_password =
      typeof formdata.get("confirm_password") === "string"
        ? String(formdata.get("confirm_password"))
        : "";
    const clientErrors = validateSignupPayload({
      name,
      email,
      phone,
      password,
      confirm_password,
    });

    if (Object.keys(clientErrors).length > 0) {
      return {
        status: 400,
        message: "Please fix the highlighted fields.",
        errors: clientErrors,
        data: {},
      };
    }

    const response = await axios.post(
      REGISTER_URL,
      {
        name,
        email,
        phone,
        password,
        confirm_password,
      },
      AUTH_REQUEST_CONFIG,
    );
    return {
      status: response.status,
      message:
        response.data?.message ?? "Account created. Verify your email to continue.",
      errors: {},
      data: {
        user: response.data?.data?.user ?? response.data?.user ?? null,
        verification:
          response.data?.data?.verification ?? response.data?.verification ?? null,
      },
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        return {
          status: error.response.status,
          message: extractAxiosMessage(error, "Please check the form details."),
          errors: extractAxiosErrors(error),
          data: {},
        };
      }

      if (error.response?.status === 503) {
        return {
          status: 503,
          message: extractAxiosMessage(
            error,
            "Account created, but verification email could not be sent.",
          ),
          errors: {},
          data: {
            user: error.response.data?.data?.user ?? null,
            verification: error.response.data?.data?.verification ?? null,
          },
        };
      }

      if (error.response?.status === 409) {
        return {
          status: 409,
          message: extractAxiosMessage(
            error,
            "An account already exists with this email or phone.",
          ),
          errors: extractAxiosErrors(error),
          data: {},
        };
      }
    }

    return {
      status: 500,
      message: "Something went wrong. Try again.",
      errors: {},
      data: {},
    };
  }
}
export async function forgetAction(prevState: unknown, formData: FormData) {
  try {
    const email = normalizeIdentifier(formData.get("email")).toLowerCase();
    const response = await axios.post(
      forgetPassword,
      {
        email,
      },
      AUTH_REQUEST_CONFIG,
    );
    return {
      status: 200,
      message:
        response.data?.message ??
        "If an account exists, a reset link has been sent.",
      errors: {},
      data: {},
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 422 || error.response?.status === 429) {
        return {
          status: error.response.status,
          message: extractAxiosMessage(error, "Please check the email address."),
          errors: extractAxiosErrors(error),
          data: {},
        };
      }
    }

    return {
      status: 500,
      message: "something went wrong. Try again",
      errors: {},
      data: {},
    };
  }
}
export async function loginAction(prevState: unknown, formData: FormData) {
  try {
    const rawIdentifier = normalizeIdentifier(
      formData.get("identifier") ?? formData.get("email"),
    );
    const normalizedPhone = rawIdentifier.replace(/[^\d+]/g, "");
    const isEmailIdentifier = EMAIL_REGEX.test(rawIdentifier.toLowerCase());

    const rememberMe = formData.get("rememberMe") === "true";

    const response = await axios.post(
      check_credential,
      {
        identifier: rawIdentifier,
        email: isEmailIdentifier ? rawIdentifier.toLowerCase() : undefined,
        phone: !isEmailIdentifier ? normalizedPhone || undefined : undefined,
        password: formData.get("password"),
        rememberMe,
      },
      AUTH_REQUEST_CONFIG,
    );
    const authPayload = response.data?.data ?? response.data;
    return {
      status: 200,
      message: "Credentials verified. Logging you in...",
      errors: {},
      data: {
        identifier: rawIdentifier,
        password: formData.get("password"),
        rememberMe,
        token: authPayload?.token ?? null,
        user: authPayload?.user ?? null,
      },
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 422) {
        return {
          status: 422,
          message: extractAxiosMessage(error, "Please check your credentials."),
          errors: error.response.data.errors,
          data: {},
        };
      }

      if (error.response?.status === 401) {
        return {
          status: 401,
          message: extractAxiosMessage(error, "Invalid email/phone or password."),
          errors: {},
          data: {},
        };
      }

      if (error.response?.status === 403) {
        return {
          status: 403,
          message: extractAxiosMessage(error, "Please verify your email first"),
          errors: {},
          data: {
            code:
              typeof error.response.data?.code === "string"
                ? error.response.data.code
                : null,
            email:
              error.response.data?.data?.email ??
              normalizeIdentifier(formData.get("identifier") ?? formData.get("email")),
            retryAfter: error.response.data?.data?.retryAfter ?? null,
            expiresIn: error.response.data?.data?.expiresIn ?? null,
          },
        };
      }
    }

    return {
      status: 500,
      message: "Something went wrong. Try again.",
      errors: {},
      data: {},
    };
  }
}

export async function workerLoginAction(prevState: unknown, formData: FormData) {
  try {
    const rawIdentifier = normalizeIdentifier(
      formData.get("identifier") ?? formData.get("email"),
    );
    const normalizedPhone = rawIdentifier.replace(/[^\d+]/g, "");
    const isEmailIdentifier = EMAIL_REGEX.test(rawIdentifier.toLowerCase());

    const rememberMe = formData.get("rememberMe") === "true";

    const response = await axios.post(
      WORKER_LOGIN_URL,
      {
        identifier: rawIdentifier,
        email: isEmailIdentifier ? rawIdentifier.toLowerCase() : undefined,
        phone: !isEmailIdentifier ? normalizedPhone || undefined : undefined,
        password: formData.get("password"),
        rememberMe,
      },
      AUTH_REQUEST_CONFIG,
    );
    const authPayload = response.data?.data ?? response.data;
    return {
      status: 200,
      message: "Worker credentials matched",
      errors: {},
      data: {
        identifier: rawIdentifier,
        password: formData.get("password"),
        rememberMe,
        token: authPayload?.token ?? null,
        user: authPayload?.user ?? null,
      },
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 422) {
        return {
          status: 422,
          message: extractAxiosMessage(error, "Please check your credentials."),
          errors: error.response.data.errors,
          data: {},
        };
      }

      if (error.response?.status === 401) {
        return {
          status: 401,
          message: extractAxiosMessage(error, "Invalid email/phone or password."),
          errors: {},
          data: {},
        };
      }
    }

    return {
      status: 500,
      message: "Something went wrong. Try again.",
      errors: {},
      data: {},
    };
  }
}

export async function resetPasswordAction(prevState: unknown, formdata: FormData) {
  try {
    const email = normalizeIdentifier(formdata.get("email")).toLowerCase();
    const password = normalizeIdentifier(formdata.get("password"));
    const confirmPassword = normalizeIdentifier(
      formdata.get("confirm_password") ?? formdata.get("confirmpassword"),
    );
    const token = normalizeIdentifier(formdata.get("token"));

    await axios.post(
      resetPassword,
      {
        email,
        password,
        confirm_password: confirmPassword,
        token,
      },
      AUTH_REQUEST_CONFIG,
    );
    return {
      status: 200,
      message: "Password changed successfully. Redirecting to login...",
      errors: {},
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 422 || error.response?.status === 429) {
        return {
          status: error.response.status,
          message: extractAxiosMessage(error, "Unable to reset password."),
          errors: extractAxiosErrors(error),
          data: {},
        };
      }
    }

    return {
      status: 500,
      message: "something went wrong. Try again",
      errors: {},
    };
  }
}

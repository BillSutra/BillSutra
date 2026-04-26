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

const normalizeIdentifier = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const extractAxiosMessage = (error: AxiosError, fallback: string) => {
  const responseMessage = (error.response?.data as { message?: unknown })
    ?.message;

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  return fallback;
};

export async function registerAction(prevState: unknown, formdata: FormData) {
  try {
    const phone = normalizeIdentifier(formdata.get("phone"));

    const response = await axios.post(REGISTER_URL, {
      name: formdata.get("name"),
      email: formdata.get("email"),
      phone: phone || undefined,
      password: formdata.get("password"),
      confirm_password: formdata.get("confirm_password"),
    });
    return {
      status: 200,
      message: response.data?.message ?? "Registration successful.",
      errors: {},
      data: {
        token: response.data?.data?.token ?? response.data?.token ?? null,
        user: response.data?.data?.user ?? response.data?.user ?? null,
      },
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 422) {
        return {
          status: 422,
          message: extractAxiosMessage(error, "Please check the form details."),
          errors: error.response.data.errors,
          data: {},
        };
      }

      if (error.response?.status === 409) {
        return {
          status: 409,
          message: extractAxiosMessage(
            error,
            "An account already exists with this email or phone.",
          ),
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
export async function forgetAction(prevState: unknown, formData: FormData) {
  try {
    const response = await axios.post(forgetPassword, {
      email: formData.get("email"),
    });
    return {
      status: 200,
      message: response.data?.message ?? "Password reset email sent.",
      errors: {},
      data: {},
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 422) {
        return {
          status: 422,
          message: error.response.data.message,
          errors: error.response.data.errors,
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

    const response = await axios.post(check_credential, {
      identifier: rawIdentifier,
      email: isEmailIdentifier ? rawIdentifier.toLowerCase() : undefined,
      phone: !isEmailIdentifier ? normalizedPhone || undefined : undefined,
      password: formData.get("password"),
    });
    const authPayload = response.data?.data ?? response.data;
    return {
      status: 200,
      message: "Credentials verified. Logging you in...",
      errors: {},
      data: {
        identifier: rawIdentifier,
        password: formData.get("password"),
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

export async function workerLoginAction(prevState: unknown, formData: FormData) {
  try {
    const rawIdentifier = normalizeIdentifier(
      formData.get("identifier") ?? formData.get("email"),
    );
    const normalizedPhone = rawIdentifier.replace(/[^\d+]/g, "");
    const isEmailIdentifier = EMAIL_REGEX.test(rawIdentifier.toLowerCase());

    const response = await axios.post(WORKER_LOGIN_URL, {
      identifier: rawIdentifier,
      email: isEmailIdentifier ? rawIdentifier.toLowerCase() : undefined,
      phone: !isEmailIdentifier ? normalizedPhone || undefined : undefined,
      password: formData.get("password"),
    });
    const authPayload = response.data?.data ?? response.data;
    return {
      status: 200,
      message: "Worker credentials matched",
      errors: {},
      data: {
        identifier: rawIdentifier,
        password: formData.get("password"),
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
    await axios.post(resetPassword, {
      email: formdata.get("email"),
      password: formdata.get("password"),
      confirm_password: formdata.get("confirm_password"),
      token: formdata.get("token"),
    });
    return {
      status: 200,
      message: "Reset password successful ",
      errors: {},
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 422) {
        return {
          status: 422,
          message: error.response.data.message,
          errors: error.response.data.errors,
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

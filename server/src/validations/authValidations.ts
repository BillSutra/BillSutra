import { z } from "zod";

const SIGNUP_EMAIL_REGEX =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const FULL_NAME_REGEX = /^[A-Za-z ]{2,50}$/;
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9\s]/;

const normalizeName = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;
const normalizePhone = (value: unknown) =>
  typeof value === "string" ? value.replace(/\D/g, "") : value;

const fullNameSchema = z.preprocess(
  normalizeName,
  z.string().superRefine((value, ctx) => {
    if (!value) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name is required" });
      return;
    }
    if (/\d/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name cannot contain numbers",
      });
      return;
    }
    if (!FULL_NAME_REGEX.test(value) || !/[A-Za-z]/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter valid full name",
      });
    }
  }),
);

const strongPasswordSchema = z.string().superRefine((value, ctx) => {
  if (
    !value ||
    value.length < 8 ||
    value.length > 64 ||
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/\d/.test(value) ||
    !SPECIAL_CHARACTER_REGEX.test(value) ||
    /\s/.test(value)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Use a stronger password.",
    });
  }
});

export const registerSchema = z
  .object({
    name: fullNameSchema,
    email: z.preprocess(
      normalizeEmail,
      z.string().max(100).regex(SIGNUP_EMAIL_REGEX, {
        message: "Enter a valid email address.",
      }),
    ),
    phone: z.preprocess(
      normalizePhone,
      z.string().regex(INDIAN_PHONE_REGEX, {
        message: "Enter a valid 10-digit mobile number.",
      }),
    ),
    password: strongPasswordSchema,
    confirm_password: z.string({ message: "Confirm your password." }).min(1, {
      message: "Confirm your password.",
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export const loginSchema = z.object({
  email: z.string({ message: "Enter Email" }).email({
    message: "Enter valid Email",
  }),
  password: z.string({ message: "Enter Password" }).min(6, {
    message: "Password must be at least 6 characters long",
  }),
});

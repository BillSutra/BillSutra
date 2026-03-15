"use client";
import React, { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
// import Link from "next/link";
import { forgetAction } from "@/actions/authActions";
// import SubmitBtn from "../common/submitBtn";
import SubmitBtn from "@/components/common/SubmitBtn";
// import { signIn } from "next-auth/react";
import Env from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/emailService";
export default function ForgetPass() {
  const initialState = {
    message: "",
    status: 0,
    errors: {},
    data: {},
  };
  const [state, formAction] = useActionState(forgetAction, initialState);

  useEffect(() => {
    const sendResetEmail = async () => {
      try {
        const email = String(state.data?.email ?? "");
        const token = String(state.data?.token ?? "");
        const appUrl =
          Env.APP_URL ||
          (typeof window !== "undefined" ? window.location.origin : "");

        if (!email || !token || !appUrl) return;

        const resetLink = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
        await sendPasswordResetEmail({
          user_email: email,
          reset_link: resetLink,
        });
        toast.success("Email sent successfully");
      } catch {
        toast.error("Failed to send email");
      }
    };

    if (state.status === 500) {
      toast.error(state.message);
    } else if (state.status === 200) {
      toast.success(state.message);
      void sendResetEmail();
    }
  }, [state]);

  return (
    <form action={formAction}>
      <div className="mt-4">
        <Label htmlFor="email">Email</Label>
        <Input placeholder="Type your email" name="email" />
        <span className="text-red-400">{state.errors?.email}</span>
      </div>

      <div className="mt-4">
        <SubmitBtn />
      </div>
    </form>
  );
}

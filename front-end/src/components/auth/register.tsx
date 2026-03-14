"use client";
import React, { useActionState, useEffect } from "react";

import { registerAction } from "@/actions/authActions";
import SubmitBtn from "@/components/common/SubmitBtn";
import { Input } from "@/components/ui/input";
// import { useFormState } from 'react-dom';
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
const Register = () => {
  const initalState = {
    status: 0,
    message: "",
    errors: {},
  };
  const [state, formAction] = useActionState(registerAction, initalState);

  useEffect(() => {
    if (state.status === 500) {
      toast.error(state.message);
    } else if (state.status === 422) {
      toast.error(state.message);
    } else if (state.status === 200) {
      toast.success(state.message);
    }
  }, [state]);

  const handleGoogleSignup = () => {
    signIn("google", { callbackUrl: "/dashboard", redirect: true });
  };

  return (
    <div>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" placeholder="Your name" type="text" />
          <span className="text-xs text-[#b45309]">{state.errors?.name}</span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            placeholder="you@company.com"
            type="email"
          />
          <span className="text-xs text-[#b45309]">{state.errors?.email}</span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            placeholder="Create a password"
            type="password"
          />
          <span className="text-xs text-[#b45309]">
            {state.errors?.password}
          </span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm_password">Confirm password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            placeholder="Repeat your password"
            type="password"
          />
          <span className="text-xs text-[#b45309]">
            {state.errors?.confirm_password}
          </span>
        </div>

        <SubmitBtn />
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#ecdccf]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#8a6d56]">
              Or continue with
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 flex w-full items-center justify-center gap-3 border-[#ecdccf] bg-white"
          onClick={handleGoogleSignup}
        >
          <Image
            src="/images/google.png"
            alt="Google logo"
            width={18}
            height={18}
          />
          Sign up with Google
        </Button>
      </div>
    </div>
  );
};

export default Register;

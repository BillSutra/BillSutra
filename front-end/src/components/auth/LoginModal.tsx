"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { markAuthLoginInProgress } from "@/lib/secureAuth";

const LoginModel = () => {
  const handleLogin = () => {
    markAuthLoginInProgress();
    void signIn("google", {
      callbackUrl: "/auth/google-complete?next=/dashboard",
      redirect: true,
    });
  };
  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button className="bg-red-500 hover:bg-red-600">Get started</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">Welcome to BillSutra</DialogTitle>
            <DialogDescription>
              BillSutra keeps your invoices, inventory, and collections in one
              focused workspace.
            </DialogDescription>
          </DialogHeader>
          <Button variant="outline" onClick={handleLogin}>
            <Image
              src="/images/google.png"
              className="mr-3"
              alt="google logo"
              width={20}
              height={20}
            />
            Continue with Google
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginModel;

"use client";

import React, { Suspense, useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserAvtar from "../common/UserAvtar";
import LogoutModal from "./LogoutModal";
import dynamic from "next/dynamic";
import Link from "next/link";
const LogoutModalDynamic = dynamic(() => import("../auth/LogoutModal"));
const ProfileMenu = ({ name, image }: { name: string; image?: string }) => {
  const [logoutopen, setLogoutOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <UserAvtar name={name} image={image} />;
  }
  return (
    <div>
      {logoutopen && (
        <Suspense fallback={<div>Loading...</div>}>
          <LogoutModalDynamic open={logoutopen} setOpen={setLogoutOpen} />
        </Suspense>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger>
          <UserAvtar name={name} image={image} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setLogoutOpen(true);
            }}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ProfileMenu;

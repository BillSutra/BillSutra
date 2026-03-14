"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchUserProfile,
  updateUserPassword,
  updateUserProfile,
  type UserProfile,
} from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type ProfileClientProps = {
  initialProfile: UserProfile;
};

const ProfileClient = ({ initialProfile }: ProfileClientProps) => {
  const { data } = useQuery({
    queryKey: ["users", "me"],
    queryFn: fetchUserProfile,
    initialData: initialProfile,
  });

  const profile = data ?? initialProfile;
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const canChangePassword = profile.provider !== "google";

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
  }, [profile.name, profile.email]);

  const hasProfileChanges = useMemo(
    () => name.trim() !== profile.name || email.trim() !== profile.email,
    [name, email, profile.name, profile.email],
  );

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    if (!hasProfileChanges) {
      setProfileError("No changes to save.");
      return;
    }

    setProfileSaving(true);
    try {
      const updated = await updateUserProfile({
        name: name.trim(),
        email: email.trim(),
      });
      setName(updated.name);
      setEmail(updated.email);
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileError("Unable to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await updateUserPassword({
        current_password: currentPassword,
        password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated successfully.");
    } catch (error) {
      setPasswordError("Unable to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1b16]">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
            Profile
          </p>
          <h1 className="text-3xl font-semibold truncate" title={profile.name}>
            {profile.name}
          </h1>
          <p className="max-w-2xl text-sm text-[#5c4b3b]">
            Manage your account details and personal preferences.
          </p>
        </header>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-4">
            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">Account details</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input
                      id="profile-name"
                      className="truncate text-sm sm:text-base"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-email">Email address</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      className="truncate text-sm sm:text-base"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? "Saving..." : "Save changes"}
                    </Button>
                    {profileMessage && (
                      <span className="text-sm text-[#0f766e]">
                        {profileMessage}
                      </span>
                    )}
                    {profileError && (
                      <span className="text-sm text-[#b45309]">
                        {profileError}
                      </span>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">Change password</CardTitle>
              </CardHeader>
              <CardContent>
                {canChangePassword ? (
                  <form className="grid gap-4" onSubmit={handlePasswordSubmit}>
                    <div className="grid gap-2">
                      <Label htmlFor="current-password">Current password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">
                        Confirm new password
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={passwordSaving}>
                        {passwordSaving ? "Updating..." : "Update password"}
                      </Button>
                      {passwordMessage && (
                        <span className="text-sm text-[#0f766e]">
                          {passwordMessage}
                        </span>
                      )}
                      {passwordError && (
                        <span className="text-sm text-[#b45309]">
                          {passwordError}
                        </span>
                      )}
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-[#5c4b3b]">
                    Password changes are managed through Google for this
                    account.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">Account status</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-[#5c4b3b]">
                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    Provider
                  </p>
                  <p
                    className="mt-2 text-sm text-[#1f1b16] truncate"
                    title={profile.provider}
                  >
                    {profile.provider}
                  </p>
                </div>
                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    Email verified
                  </p>
                  <p className="mt-2 text-sm text-[#1f1b16]">
                    {profile.is_email_verified ? "Verified" : "Pending"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/invoices">Create invoice</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfileClient;

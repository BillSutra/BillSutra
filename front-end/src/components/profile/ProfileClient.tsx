"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteUserAccount,
  deleteUserData,
  fetchUserProfile,
  updateUserPassword,
  updateUserProfile,
  type UserProfile,
} from "@/lib/apiClient";
import {
  sendDeleteAccountConfirmationEmail,
  sendDeleteDataConfirmationEmail,
} from "@/lib/emailService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import Link from "next/link";

type ProfileClientProps = {
  initialProfile: UserProfile;
};

const ProfileClient = ({ initialProfile }: ProfileClientProps) => {
  const router = useRouter();
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
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteDataConfirmation, setDeleteDataConfirmation] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] =
    useState("");
  const [deleteDataError, setDeleteDataError] = useState<string | null>(null);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null,
  );
  const [deleteDataLoading, setDeleteDataLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  const canChangePassword = profile.provider !== "google";

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
  }, [profile.name, profile.email]);

  const hasProfileChanges = useMemo(
    () => name.trim() !== profile.name || email.trim() !== profile.email,
    [name, email, profile.name, profile.email],
  );
  const canConfirmDeleteData = deleteDataConfirmation.trim() === "DELETE";
  const deleteAccountVerification = deleteAccountConfirmation.trim();
  const canConfirmDeleteAccount =
    deleteAccountVerification === "DELETE" ||
    deleteAccountVerification.toLowerCase() === profile.email.toLowerCase();

  const parseApiError = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { message?: string } | undefined)
        ?.message;
      if (message) return message;
    }

    return fallback;
  };

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

  const closeDeleteDataModal = () => {
    setDeleteDataOpen(false);
    setDeleteDataConfirmation("");
    setDeleteDataError(null);
  };

  const closeDeleteAccountModal = () => {
    setDeleteAccountOpen(false);
    setDeleteAccountConfirmation("");
    setDeleteAccountError(null);
  };

  const handleDeleteData = async () => {
    if (!canConfirmDeleteData) return;

    setDeleteDataLoading(true);
    setDeleteDataError(null);
    try {
      await sendDeleteDataConfirmationEmail({
        user_email: profile.email,
        user_name: profile.name,
      });
      toast.success("Email sent successfully");
      await deleteUserData();
      toast.success("Your data has been deleted.");
      closeDeleteDataModal();
    } catch (error) {
      setDeleteDataError(
        parseApiError(
          error,
          "Failed to send email or delete your data right now.",
        ),
      );
      toast.error("Failed to send email");
    } finally {
      setDeleteDataLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!canConfirmDeleteAccount) return;

    setDeleteAccountLoading(true);
    setDeleteAccountError(null);
    try {
      await sendDeleteAccountConfirmationEmail({
        user_email: profile.email,
        user_name: profile.name,
      });
      toast.success("Email sent successfully");
      await deleteUserAccount();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("token");
        window.sessionStorage.setItem(
          "account_deleted_message",
          "Your account has been deleted.",
        );
      }
      await signOut({ redirect: false });
      router.push("/");
      router.refresh();
    } catch (error) {
      setDeleteAccountError(
        parseApiError(
          error,
          "Failed to send email or delete your account right now.",
        ),
      );
      toast.error("Failed to send email");
      setDeleteAccountLoading(false);
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

            <Card className="border-red-200 bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg text-red-700">
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    Delete your data
                  </p>
                  <p className="mt-1 text-sm text-red-700/90">
                    Permanently remove your stored business data while keeping
                    your account access.
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setDeleteDataOpen(true)}
                  >
                    Delete My Data
                  </Button>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    Delete your account
                  </p>
                  <p className="mt-1 text-sm text-red-700/90">
                    Permanently remove your login and all associated data.
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setDeleteAccountOpen(true)}
                  >
                    Delete My Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Modal
        open={deleteDataOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDataModal();
            return;
          }
          setDeleteDataOpen(true);
        }}
        title="Delete Your Data"
        description="This will permanently delete all your stored data including activity history and uploaded content. This action cannot be undone."
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-data-confirmation">
              Type DELETE to enable deletion
            </Label>
            <Input
              id="delete-data-confirmation"
              value={deleteDataConfirmation}
              onChange={(event) => {
                setDeleteDataConfirmation(event.target.value);
                setDeleteDataError(null);
              }}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          {deleteDataError && (
            <p className="text-sm text-[#b45309]">{deleteDataError}</p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDataModal}
              disabled={deleteDataLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteData}
              disabled={!canConfirmDeleteData || deleteDataLoading}
            >
              {deleteDataLoading ? "Deleting..." : "Delete Data"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteAccountOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteAccountModal();
            return;
          }
          setDeleteAccountOpen(true);
        }}
        title="Delete Account"
        description="This will permanently delete your account and all associated data. This action cannot be undone."
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-account-confirmation">
              Type your email or DELETE to confirm
            </Label>
            <Input
              id="delete-account-confirmation"
              value={deleteAccountConfirmation}
              onChange={(event) => {
                setDeleteAccountConfirmation(event.target.value);
                setDeleteAccountError(null);
              }}
              placeholder={profile.email || "DELETE"}
              autoComplete="off"
            />
          </div>
          {deleteAccountError && (
            <p className="text-sm text-[#b45309]">{deleteAccountError}</p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteAccountModal}
              disabled={deleteAccountLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={!canConfirmDeleteAccount || deleteAccountLoading}
            >
              {deleteAccountLoading ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfileClient;

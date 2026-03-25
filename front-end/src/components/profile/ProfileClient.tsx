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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import Link from "next/link";
import PasskeySettingsCard from "@/components/profile/PasskeySettingsCard";
import PlanManagementCard from "@/components/pricing/PlanManagementCard";
import { useI18n } from "@/providers/LanguageProvider";

type ProfileClientProps = {
  initialProfile: UserProfile;
};

const ProfileClient = ({ initialProfile }: ProfileClientProps) => {
  const router = useRouter();
  const { t } = useI18n();
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
  const deleteKeyword = t("profilePage.deleteKeyword");
  const canConfirmDeleteData =
    deleteDataConfirmation.trim() === "DELETE" ||
    deleteDataConfirmation.trim() === deleteKeyword;
  const deleteAccountVerification = deleteAccountConfirmation.trim();
  const canConfirmDeleteAccount =
    deleteAccountVerification === "DELETE" ||
    deleteAccountVerification === deleteKeyword ||
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
      setProfileError(t("profilePage.noChanges"));
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
      setProfileMessage(t("profilePage.profileUpdated"));
    } catch {
      setProfileError(t("profilePage.profileUpdateError"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("profilePage.fillPasswordFields"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("profilePage.passwordMismatch"));
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
      setPasswordMessage(t("profilePage.passwordUpdated"));
    } catch {
      setPasswordError(t("profilePage.passwordUpdateError"));
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
      await deleteUserData();
      toast.success(t("profilePage.deleteDataToast"));
      closeDeleteDataModal();
    } catch (error) {
      setDeleteDataError(
        parseApiError(
          error,
          t("profilePage.deleteDataError"),
        ),
      );
      toast.error(t("profilePage.deleteDataErrorToast"));
    } finally {
      setDeleteDataLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!canConfirmDeleteAccount) return;

    setDeleteAccountLoading(true);
    setDeleteAccountError(null);
    try {
      await deleteUserAccount();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("token");
        window.sessionStorage.setItem(
          "account_deleted_message",
          t("profilePage.deleteAccountDeletedMessage"),
        );
      }
      await signOut({ redirect: false });
      router.push("/");
      router.refresh();
    } catch (error) {
      setDeleteAccountError(
        parseApiError(
          error,
          t("profilePage.deleteAccountError"),
        ),
      );
      toast.error(t("profilePage.deleteAccountErrorToast"));
      setDeleteAccountLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1b16]">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
            {t("profilePage.kicker")}
          </p>
          <h1 className="text-3xl font-semibold truncate" title={profile.name}>
            {profile.name}
          </h1>
          <p className="max-w-2xl text-sm text-[#5c4b3b]">
            {t("profilePage.description")}
          </p>
        </header>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-4">
            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">{t("profilePage.accountDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-name">{t("profilePage.fullName")}</Label>
                    <Input
                      id="profile-name"
                      className="truncate text-sm sm:text-base"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={t("profilePage.enterName")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-email">{t("profilePage.emailAddress")}</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      className="truncate text-sm sm:text-base"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={t("profilePage.enterEmail")}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? t("profilePage.saving") : t("profilePage.saveChanges")}
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
                <CardTitle className="text-lg">{t("profilePage.changePassword")}</CardTitle>
              </CardHeader>
              <CardContent>
                {canChangePassword ? (
                  <form className="grid gap-4" onSubmit={handlePasswordSubmit}>
                    <div className="grid gap-2">
                      <Label htmlFor="current-password">{t("profilePage.currentPassword")}</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        placeholder={t("profilePage.enterCurrentPassword")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-password">{t("profilePage.newPassword")}</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder={t("profilePage.enterNewPassword")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">
                        {t("profilePage.confirmNewPassword")}
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder={t("profilePage.confirmNewPasswordPlaceholder")}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={passwordSaving}>
                        {passwordSaving
                          ? t("profilePage.updatingPassword")
                          : t("profilePage.updatePassword")}
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
                    {t("profilePage.googlePasswordNotice")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            <PlanManagementCard
              title={t("profilePage.planTitle")}
              description={t("profilePage.planDescription")}
            />

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">{t("profilePage.accountStatus")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-[#5c4b3b]">
                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("profilePage.provider")}
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
                    {t("profilePage.emailVerified")}
                  </p>
                  <p className="mt-2 text-sm text-[#1f1b16]">
                    {profile.is_email_verified
                      ? t("profilePage.verified")
                      : t("profilePage.pending")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">{t("profilePage.quickActions")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/pricing">{t("profilePage.openPricing")}</Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/dashboard">{t("profilePage.backToDashboard")}</Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/invoices">{t("profilePage.createInvoice")}</Link>
                </Button>
              </CardContent>
            </Card>

            <PasskeySettingsCard />

            <Card className="border-red-200 bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg text-red-700">
                  {t("profilePage.dangerZone")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {t("profilePage.deleteDataTitle")}
                  </p>
                  <p className="mt-1 text-sm text-red-700/90">
                    {t("profilePage.deleteDataDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setDeleteDataOpen(true)}
                  >
                    {t("profilePage.deleteMyData")}
                  </Button>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {t("profilePage.deleteAccountTitle")}
                  </p>
                  <p className="mt-1 text-sm text-red-700/90">
                    {t("profilePage.deleteAccountDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setDeleteAccountOpen(true)}
                  >
                    {t("profilePage.deleteMyAccount")}
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
        title={t("profilePage.deleteDataModalTitle")}
        description={t("profilePage.deleteDataModalDescription")}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-data-confirmation">
              {t("profilePage.deleteDataConfirmLabel")}
            </Label>
            <Input
              id="delete-data-confirmation"
              value={deleteDataConfirmation}
              onChange={(event) => {
                setDeleteDataConfirmation(event.target.value);
                setDeleteDataError(null);
              }}
              placeholder={deleteKeyword}
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
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteData}
              disabled={!canConfirmDeleteData || deleteDataLoading}
            >
              {deleteDataLoading
                ? t("profilePage.deleting")
                : t("profilePage.deleteDataButton")}
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
        title={t("profilePage.deleteAccountModalTitle")}
        description={t("profilePage.deleteAccountModalDescription")}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-account-confirmation">
              {t("profilePage.deleteAccountConfirmLabel")}
            </Label>
            <Input
              id="delete-account-confirmation"
              value={deleteAccountConfirmation}
              onChange={(event) => {
                setDeleteAccountConfirmation(event.target.value);
                setDeleteAccountError(null);
              }}
              placeholder={profile.email || deleteKeyword}
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
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={!canConfirmDeleteAccount || deleteAccountLoading}
            >
              {deleteAccountLoading
                ? t("profilePage.deleting")
                : t("profilePage.deleteAccountButton")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfileClient;

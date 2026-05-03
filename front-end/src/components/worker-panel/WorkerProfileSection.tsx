"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchWorkerProfile,
  updateWorkerProfile,
} from "@/lib/apiClient";
import { User, Mail, Phone, Calendar, ShieldCheck, Loader2, Save, X } from "lucide-react";

const WorkerProfileSection = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
  }>({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});

  const { data: profile, isLoading } = useQuery({
    queryKey: ["worker", "profile"],
    queryFn: fetchWorkerProfile,
  });

  React.useEffect(() => {
    if (profile && !isEditing) {
      setFormData({
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? "",
      });
    }
  }, [profile, isEditing]);

  const updateMutation = useMutation({
    mutationFn: updateWorkerProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["worker", "profile"], data);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      setErrors({});
    },
    onError: (error: { response?: { data?: { message?: string; errors?: Record<string, string> } } }) => {
      const message =
        error.response?.data?.message ?? "Failed to update profile";
      toast.error(message);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors as typeof errors);
      }
    },
  });

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/\D/g, ""))) {
      newErrors.phone = "Phone must be 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const hasChanges =
      profile &&
      (formData.name !== profile.name ||
        formData.email !== profile.email ||
        (formData.phone ?? "") !== (profile.phone ?? ""));

    if (!hasChanges) {
      toast.info("No changes to save");
      setIsEditing(false);
      return;
    }

    updateMutation.mutate({
      name: formData.name !== profile?.name ? formData.name : undefined,
      email: formData.email !== profile?.email ? formData.email : undefined,
      phone:
        (formData.phone ?? "") !== (profile?.phone ?? "")
          ? formData.phone
          : undefined,
    });
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? "",
      });
    }
    setIsEditing(false);
    setErrors({});
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          {!isEditing && profile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Name
            </Label>
            {isEditing ? (
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className={errors.name ? "border-destructive" : ""}
              />
            ) : (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                {profile?.name}
              </div>
            )}
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            {isEditing ? (
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className={errors.email ? "border-destructive" : ""}
              />
            ) : (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                {profile?.email}
              </div>
            )}
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Phone
            </Label>
            {isEditing ? (
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData((prev) => ({ ...prev, phone: digits }));
                }}
                placeholder="10 digit phone number"
                className={errors.phone ? "border-destructive" : ""}
              />
            ) : (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                {profile?.phone ?? "Not set"}
              </div>
            )}
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Role
            </Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
              {profile?.accessRole ?? "STAFF"}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Joined Date
            </Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
              {profile?.joiningDate
                ? new Date(profile.joiningDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : new Date(profile?.createdAt ?? "").toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    },
                  )}
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkerProfileSection;

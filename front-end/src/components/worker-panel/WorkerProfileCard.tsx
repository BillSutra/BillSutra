"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Save,
  User,
  X,
} from "lucide-react";
import UserAvtar from "@/components/common/UserAvtar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateWorkerProfile,
  uploadWorkerProfilePhoto,
  type WorkerProfileResponse,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type WorkerProfileCardProps = {
  profile?: WorkerProfileResponse;
  image?: string;
  isLoading?: boolean;
  onProfileUpdated?: () => void;
};

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
};

type ApiError = {
  response?: { data?: { message?: string; errors?: Record<string, string> } };
};

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const PHOTO_COMPRESSION_THRESHOLD_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1200;
const PHOTO_QUALITY = 0.82;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read selected image."));
    };
    image.src = url;
  });

const compressProfilePhoto = async (file: File) => {
  if (file.size <= PHOTO_COMPRESSION_THRESHOLD_BYTES) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(
    1,
    MAX_PHOTO_DIMENSION / Math.max(image.width, image.height),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  const fileName = file.name.replace(/\.[^.]+$/, "") || "profile-photo";
  return new File([blob], `${fileName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
};

const ReadOnlyField = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Label>
    <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-foreground dark:border-zinc-800 dark:bg-zinc-950/50">
      {value}
    </div>
  </div>
);

const WorkerProfileCard = ({
  profile,
  image,
  isLoading,
  onProfileUpdated,
}: WorkerProfileCardProps) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string | undefined>(image);
  const [isDraggingPhoto, setIsDraggingPhoto] = React.useState(false);
  const [formData, setFormData] = React.useState<ProfileForm>({
    name: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = React.useState<Partial<ProfileForm>>({});

  React.useEffect(() => {
    if (!profile || isEditing) return;
    setFormData({
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? "",
    });
  }, [isEditing, profile]);

  React.useEffect(() => {
    setPhotoPreview(image);
  }, [image]);

  const updateMutation = useMutation({
    mutationFn: updateWorkerProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["worker", "profile"], data);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      setErrors({});
      onProfileUpdated?.();
    },
    onError: (error: ApiError) => {
      const message = error.response?.data?.message ?? "Failed to update profile";
      toast.error(message);
      setErrors(error.response?.data?.errors as Partial<ProfileForm> ?? {});
    },
  });

  const photoMutation = useMutation({
    mutationFn: uploadWorkerProfilePhoto,
    onSuccess: (data) => {
      queryClient.setQueryData<WorkerProfileResponse | undefined>(
        ["worker", "profile"],
        (current) => (current ? { ...current, imageUrl: data.imageUrl } : current),
      );
      setPhotoPreview(data.imageUrl);
      toast.success("Profile photo updated");
      onProfileUpdated?.();
    },
    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ?? "Unable to upload profile photo.",
      );
      setPhotoPreview(profile?.imageUrl ?? image);
    },
  });

  const validateForm = () => {
    const nextErrors: Partial<ProfileForm> = {};
    const phoneDigits = formData.phone.replace(/\D/g, "");

    if (!formData.name.trim()) {
      nextErrors.name = "Full name is required";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = "Enter a valid email";
    }

    if (phoneDigits && phoneDigits.length !== 10) {
      nextErrors.phone = "Phone must be 10 digits";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const uploadSelectedPhoto = async (file: File) => {
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      toast.error("Unsupported image format. Upload a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      toast.error("Image too large. Maximum allowed size is 5MB.");
      return;
    }

    let uploadFile = file;
    try {
      uploadFile = await compressProfilePhoto(file);
    } catch {
      toast.error("Unable to process this image. Try another JPG, PNG, or WEBP file.");
      return;
    }

    if (uploadFile.size > MAX_PHOTO_SIZE_BYTES) {
      toast.error("Image too large after compression. Maximum allowed size is 5MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(uploadFile);
    setPhotoPreview(previewUrl);
    photoMutation.mutate(uploadFile, {
      onSettled: () => URL.revokeObjectURL(previewUrl),
    });
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void uploadSelectedPhoto(file);
  };

  const handlePhotoDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingPhoto(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void uploadSelectedPhoto(file);
  };

  const handleSave = () => {
    if (!profile || !validateForm()) return;

    const phone = formData.phone.replace(/\D/g, "");
    const payload = {
      name: formData.name.trim() !== profile.name ? formData.name.trim() : undefined,
      email: formData.email.trim() !== profile.email ? formData.email.trim() : undefined,
      phone: phone !== (profile.phone ?? "") ? phone : undefined,
    };

    if (!payload.name && !payload.email && !payload.phone) {
      toast.info("No profile changes to save");
      setIsEditing(false);
      return;
    }

    updateMutation.mutate(payload);
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? "",
      });
    }
    setErrors({});
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card id="worker-profile">
        <CardContent className="space-y-5 pt-0">
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="worker-profile">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep your employee contact details accurate.
            </p>
          </div>
          {!isEditing ? (
            <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
              <PencilLine className="h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={cn(
            "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors dark:border-zinc-800 dark:bg-zinc-950/40 sm:flex-row sm:items-center",
            isDraggingPhoto && "border-primary bg-primary/5",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingPhoto(true);
          }}
          onDragLeave={() => setIsDraggingPhoto(false)}
          onDrop={handlePhotoDrop}
        >
          <Label
            htmlFor="worker-photo"
            className={cn(
              "group relative h-20 w-20 shrink-0 cursor-pointer rounded-full",
              photoMutation.isPending && "pointer-events-none opacity-70",
            )}
          >
            <UserAvtar
              name={profile?.name ?? "Worker"}
              image={photoPreview}
              className="h-20 w-20 text-xl"
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              {photoMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </span>
          </Label>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-foreground">
                {profile?.name}
              </h3>
              <Badge variant={profile?.status === "INACTIVE" ? "overdue" : "paid"}>
                {profile?.status ?? "ACTIVE"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Employee ID {profile?.id.slice(-8).toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, or WEBP up to 5MB. Drag and drop supported.
            </p>
          </div>
          <Label
            htmlFor="worker-photo"
            className={cn(
              "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800",
              photoMutation.isPending && "pointer-events-none opacity-60",
            )}
          >
            {photoMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {photoMutation.isPending ? "Uploading" : "Photo"}
          </Label>
          <input
            id="worker-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handlePhotoChange}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="worker-name" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Full Name
            </Label>
            <Input
              id="worker-name"
              value={formData.name}
              disabled={!isEditing || updateMutation.isPending}
              onChange={(event) =>
                setFormData((current) => ({ ...current, name: event.target.value }))
              }
              className={cn(errors.name && "border-destructive")}
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-email" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <Input
              id="worker-email"
              type="email"
              value={formData.email}
              disabled={!isEditing || updateMutation.isPending}
              onChange={(event) =>
                setFormData((current) => ({ ...current, email: event.target.value }))
              }
              className={cn(errors.email && "border-destructive")}
            />
            {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-phone" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              Phone
            </Label>
            <Input
              id="worker-phone"
              value={formData.phone}
              disabled={!isEditing || updateMutation.isPending}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                }))
              }
              placeholder="10 digit phone number"
              className={cn(errors.phone && "border-destructive")}
            />
            {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
          </div>

          <ReadOnlyField icon={BriefcaseBusiness} label="Role" value={profile?.accessRole ?? profile?.role ?? "STAFF"} />
          <ReadOnlyField icon={IdCard} label="Employee ID" value={profile?.id.slice(-8).toUpperCase() ?? "Pending"} />
          <ReadOnlyField icon={CalendarDays} label="Join Date" value={formatDate(profile?.joiningDate ?? profile?.createdAt)} />
          <ReadOnlyField icon={BadgeCheck} label="Account Status" value={profile?.status ?? "ACTIVE"} />
          <ReadOnlyField icon={MapPin} label="Address" value="Not on file" />
        </div>

        {isEditing ? (
          <div className="sticky bottom-3 z-10 flex flex-col justify-end gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 sm:static sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default WorkerProfileCard;

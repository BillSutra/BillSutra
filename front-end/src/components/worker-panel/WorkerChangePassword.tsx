"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeWorkerPassword } from "@/lib/apiClient";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";

const WorkerChangePassword = () => {
  const [formData, setFormData] = useState({
    current_password: "",
    password: "",
    confirm_password: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const changePasswordMutation = useMutation({
    mutationFn: changeWorkerPassword,
    onSuccess: () => {
      toast.success("Password changed successfully");
      setFormData({ current_password: "", password: "", confirm_password: "" });
      setErrors({});
    },
    onError: (error: { response?: { data?: { message?: string; errors?: Record<string, string> } } }) => {
      const message =
        error.response?.data?.message ?? "Failed to change password";
      toast.error(message);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        setErrors({});
      }
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.current_password) {
      newErrors.current_password = "Current password is required";
    }

    if (!formData.password) {
      newErrors.password = "New password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (!/\d/.test(formData.password)) {
      newErrors.password = "Password must contain at least 1 number";
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = "Please confirm your password";
    } else if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    changePasswordMutation.mutate({
      current_password: formData.current_password,
      password: formData.password,
      confirm_password: formData.confirm_password,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_password">Current Password</Label>
            <div className="relative">
              <Input
                id="current_password"
                type={showPasswords ? "text" : "password"}
                value={formData.current_password}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    current_password: e.target.value,
                  }))
                }
                className={errors.current_password ? "border-destructive pr-10" : "pr-10"}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.current_password && (
              <p className="text-xs text-destructive">{errors.current_password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPasswords ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                className={errors.password ? "border-destructive pr-10" : "pr-10"}
                placeholder="Min 6 chars, at least 1 number"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm Password</Label>
            <Input
              id="confirm_password"
              type={showPasswords ? "text" : "password"}
              value={formData.confirm_password}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  confirm_password: e.target.value,
                }))
              }
              className={errors.confirm_password ? "border-destructive" : ""}
              placeholder="Re-enter new password"
            />
            {errors.confirm_password && (
              <p className="text-xs text-destructive">{errors.confirm_password}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Update Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default WorkerChangePassword;

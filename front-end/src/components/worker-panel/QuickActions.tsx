"use client";

import Link from "next/link";
import {
  Download,
  FilePlus2,
  ReceiptText,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkerProfileResponse } from "@/lib/apiClient";

type QuickActionsProps = {
  profile?: WorkerProfileResponse;
  onDownloadReport: () => void;
};

const canCreate = (profile?: WorkerProfileResponse) => {
  const role = profile?.accessRole?.toUpperCase();
  return role !== "VIEWER";
};

const QuickActions = ({ profile, onDownloadReport }: QuickActionsProps) => {
  const allowCreate = canCreate(profile);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <WalletCards className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Jump into the tools available to your role.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {allowCreate ? (
          <Button asChild className="w-full justify-start">
            <Link href="/invoices">
              <FilePlus2 className="h-4 w-4" />
              Create Invoice
            </Link>
          </Button>
        ) : null}

        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/sales">
            <ReceiptText className="h-4 w-4" />
            View Sales
          </Link>
        </Button>

        {allowCreate ? (
          <Button asChild variant="outline" className="w-full justify-start">
            <Link href="/customers">
              <UserPlus className="h-4 w-4" />
              Add Customer
            </Link>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={onDownloadReport}
        >
          <Download className="h-4 w-4" />
          Download Report
        </Button>
      </CardContent>
    </Card>
  );
};

export default QuickActions;

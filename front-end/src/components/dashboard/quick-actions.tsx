import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const actions = [
  { label: "Create Invoice", href: "/invoices" },
  { label: "Add Product", href: "/products" },
  { label: "Add Customer", href: "/customers" },
  { label: "Record Payment", href: "/invoices" },
  { label: "Add Purchase", href: "/purchases" },
];

const QuickActions = ({ className }: { className?: string }) => {
  return (
    <Card className={`border-[#ecdccf] bg-white/90 ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            asChild
            variant="outline"
            className="justify-start"
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

export default QuickActions;

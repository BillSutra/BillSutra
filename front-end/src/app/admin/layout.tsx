import { AdminAuthProvider } from "@/providers/AdminAuthProvider";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}

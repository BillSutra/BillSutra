import { getServerSession } from "next-auth";
import dynamic from "next/dynamic";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";

const ProductsClient = dynamic(() => import("./ProductsClient"), {
  loading: () => (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 text-sm text-muted-foreground">
      Loading products workspace...
    </div>
  ),
});

const ProductsPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";
  const canManageProducts = session?.user?.role === "ADMIN";

  return (
    <ProductsClient
      name={name}
      image={session?.user?.image || undefined}
      canManageProducts={canManageProducts}
    />
  );
};

export default ProductsPage;

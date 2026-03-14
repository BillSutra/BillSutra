import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import ProductsClient from "./ProductsClient";

const ProductsPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return (
    <ProductsClient name={name} image={session?.user?.image || undefined} />
  );
};

export default ProductsPage;

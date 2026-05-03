import { Suspense } from "react";
import GoogleAuthCompleteClient from "@/components/auth/GoogleAuthCompleteClient";

const GoogleAuthCompletePage = () => (
  <Suspense fallback={null}>
    <GoogleAuthCompleteClient />
  </Suspense>
);

export default GoogleAuthCompletePage;

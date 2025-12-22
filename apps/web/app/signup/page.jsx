"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Signup is disabled for this demo.
// Any direct access to /signup will be redirected to /login.
export default function SignupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}


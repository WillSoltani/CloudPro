import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/app/app/api/_lib/auth";

export async function requireDashboardAccess() {
  try {
    await requireUser();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      redirect("/?auth=required");
    }
    throw error;
  }
}


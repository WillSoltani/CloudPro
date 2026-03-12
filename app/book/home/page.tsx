import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { BookHomeClient } from "@/app/book/home/BookHomeClient";

export default async function BookHomePage() {
  await requireDashboardAccess();
  return <BookHomeClient />;
}


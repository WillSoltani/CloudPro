import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { BookSettingsClient } from "@/app/book/settings/BookSettingsClient";

export default async function BookSettingsPage() {
  await requireDashboardAccess();
  return <BookSettingsClient />;
}

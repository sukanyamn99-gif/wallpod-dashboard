import { redirect } from "next/navigation";

// Dead Stock now lives inside the Stock Dashboard directly rather than as
// its own page — this route stays only to send old links/bookmarks there.
export default function DeadStockDashboardPage() {
  redirect("/dashboard/inventory");
}

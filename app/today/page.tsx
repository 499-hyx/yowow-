import { redirect } from "next/navigation";

export default function TodayRedirectPage({
  searchParams,
}: {
  searchParams?: { account?: string; date?: string };
}) {
  if (!searchParams?.account) redirect("/");
  const params = new URLSearchParams({ tab: "today" });
  if (searchParams.date) params.set("date", searchParams.date);
  redirect(`/account/${encodeURIComponent(searchParams.account)}?${params.toString()}`);
}

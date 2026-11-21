import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Settings from "./Settings";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Settings me={{ id: session.id, name: session.display_name }} />;
}

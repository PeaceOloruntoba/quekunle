import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import MemoryWall from "../MemoryWall";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Our Private Memories — TwoFold",
  robots: { index: false, follow: false },
};
export default async function MemoriesPage() {
  if (!(await getSession())) redirect("/login");
  return <MemoryWall mode="private" />;
}

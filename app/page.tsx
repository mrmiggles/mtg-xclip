import { redirect } from "next/navigation";
import { authenticated } from "@/lib/access";
import { clipboardTTL } from "@/lib/redis";
import SharedClipboard from "./clipboard";

export default async function Home() {
  if (!await authenticated()) redirect("/login");
  return <SharedClipboard ttlSeconds={clipboardTTL()} />;
}

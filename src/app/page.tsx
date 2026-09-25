import { redirect } from "next/navigation";
import { authenticateSession } from "@/application/authentication";
import { requestToken } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function Home() { redirect(await authenticateSession(await requestToken()) ? "/diagnosticos" : "/login"); }

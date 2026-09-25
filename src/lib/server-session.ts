import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateSession } from "@/application/authentication";
import { sessionCookie } from "./config";
export async function requestToken() { return (await cookies()).get(sessionCookie().name)?.value; }
export async function requirePageUser() {
  const user = await authenticateSession(await requestToken());
  if (!user) redirect("/login");
  return user;
}

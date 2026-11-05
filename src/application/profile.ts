import "server-only";
import { db } from "@/infrastructure/persistence/db";
import { requireAuthenticatedUser } from "./authorization";

/** Which hats the signed-in user wears, to tailor the quick guide. A user may wear several. */
export async function readProfiles(token: string | undefined) {
  const user = await requireAuthenticatedUser(token);
  const [record, roles] = await Promise.all([
    db().user.findUniqueOrThrow({ where: { id: user.id }, select: { methodologyCustodian: true, technicalAdmin: true } }),
    db().organizationMembership.findMany({ where: { userId: user.id, active: true, organization: { status: "ACTIVE" } }, distinct: ["role"], select: { role: true } }),
  ]);
  return {
    consultant: roles.some(row => row.role === "IEO_CONSULTANT"),
    coordinator: roles.some(row => row.role === "ORG_COORDINATOR"),
    custodian: record.methodologyCustodian,
    technicalAdmin: record.technicalAdmin,
  };
}
export type Profiles = Awaited<ReturnType<typeof readProfiles>>;

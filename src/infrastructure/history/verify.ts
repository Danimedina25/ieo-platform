import type { PrismaClient } from "@/generated/prisma/client";
import { sha256Canonical } from "@/domain/canonical";
import { engineInputFromSnapshot, type SnapshotPayload } from "@/domain/closure/snapshot";
import { ENGINE_VERSION, runEngine } from "@/domain/ieo-engine";

// Historical reproduction check (Phase 7): every frozen snapshot must still match its hash, and every successful
// run must reproduce its output hash when the engine runs again on that snapshot. Used after a restore.
export type HistoryCheck = Readonly<{ snapshots: number; runs: number; problems: string[]; otherEngineVersions: number }>;
export async function verifyHistory(client: PrismaClient): Promise<HistoryCheck> {
  const problems: string[] = [];
  const snapshots = await client.frozenSnapshot.findMany({ select: { id: true, sha256: true, payloadJson: true } });
  for (const snapshot of snapshots) if (sha256Canonical(snapshot.payloadJson) !== snapshot.sha256) problems.push(`Copia congelada ${snapshot.id}: el hash no coincide.`);
  const runs = await client.processingRun.findMany({ where: { status: "SUCCEEDED" }, select: { id: true, engineVersion: true, outputHash: true, snapshot: { select: { payloadJson: true } } } });
  let otherEngineVersions = 0;
  for (const run of runs) {
    // A run made with another engine version is reproduced with that version's artifact, not with the current one.
    if (run.engineVersion !== ENGINE_VERSION) { otherEngineVersions++; continue; }
    const output = runEngine(engineInputFromSnapshot(run.snapshot.payloadJson as unknown as SnapshotPayload));
    if (output.outputHash !== run.outputHash) problems.push(`Procesamiento ${run.id}: el resultado reproducido no coincide.`);
  }
  return { snapshots: snapshots.length, runs: runs.length, problems, otherEngineVersions };
}

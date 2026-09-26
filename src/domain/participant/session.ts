export function participantSessionExpiry(invitationExpiry: Date, issuedAt: Date, hours: number): Date {
  return new Date(Math.min(invitationExpiry.getTime(), issuedAt.getTime() + hours * 3600_000));
}
export function participantSessionUsable(session: { expiresAt: Date; lastSeenAt: Date; revokedAt: Date | null }, at: Date, idleMinutes: number): boolean {
  return !session.revokedAt && session.expiresAt > at && session.lastSeenAt.getTime() + idleMinutes * 60_000 > at.getTime();
}

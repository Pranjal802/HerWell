export function getExistingInvitationState(existing, now = new Date()) {
  if (!existing) return null;
  if (existing.status === "accepted") return "accepted";
  if (existing.status !== "pending") return null;
  return existing.inviteExpiresAt && new Date(existing.inviteExpiresAt) > now
    ? "pending"
    : "expired";
}

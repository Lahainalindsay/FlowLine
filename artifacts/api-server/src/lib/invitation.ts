import { createHash } from "node:crypto";

export type InvitationAcceptanceCandidate = {
  tokenHash: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Keeps token, recipient, expiry, and lifecycle checks together and fail-closed. */
export function canAcceptInvitation(
  invitation: InvitationAcceptanceCandidate | undefined,
  token: string,
  email: string,
  now = new Date(),
) {
  return Boolean(
    invitation
      && invitation.tokenHash === hashInvitationToken(token)
      && invitation.email === email
      && invitation.expiresAt > now
      && !invitation.acceptedAt
      && !invitation.revokedAt,
  );
}
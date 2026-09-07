import assert from "node:assert/strict";
import test from "node:test";
import { canAcceptInvitation, hashInvitationToken } from "./invitation.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const token = "M9bXSzRw1FqA0YdHc2Kp7LnVe4TgJ8uQ";
const invitation = {
  tokenHash: hashInvitationToken(token),
  email: "crew@stagetime.example",
  expiresAt: new Date("2026-01-02T00:00:00.000Z"),
  acceptedAt: null,
  revokedAt: null,
};

test("invitation acceptance admits only the intended recipient with its valid token", () => {
  assert.equal(canAcceptInvitation(invitation, token, invitation.email, now), true);
  assert.equal(canAcceptInvitation(invitation, "wrong-token", invitation.email, now), false);
  assert.equal(canAcceptInvitation(invitation, token, "other@stagetime.example", now), false);
});

test("revoked, expired, and already accepted invitations cannot be claimed", () => {
  assert.equal(canAcceptInvitation({ ...invitation, revokedAt: now }, token, invitation.email, now), false);
  assert.equal(canAcceptInvitation({ ...invitation, acceptedAt: now }, token, invitation.email, now), false);
  assert.equal(canAcceptInvitation({ ...invitation, expiresAt: now }, token, invitation.email, now), false);
});
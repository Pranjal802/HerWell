import assert from "node:assert/strict";
import { test } from "node:test";
import { getExistingInvitationState } from "./supporterInvitations.js";

const now = new Date("2026-11-06T00:00:00.000Z");

test("classifies an unexpired supporter invitation as pending", () => {
  assert.equal(getExistingInvitationState({
    status: "pending",
    inviteExpiresAt: new Date("2026-11-07T00:00:00.000Z"),
  }, now), "pending");
});

test("classifies an expired or missing-expiration invitation as expired", () => {
  assert.equal(getExistingInvitationState({
    status: "pending",
    inviteExpiresAt: new Date("2026-11-05T00:00:00.000Z"),
  }, now), "expired");
  assert.equal(getExistingInvitationState({ status: "pending" }, now), "expired");
});

test("distinguishes accepted invitations and ignores inactive statuses", () => {
  assert.equal(getExistingInvitationState({ status: "accepted" }, now), "accepted");
  assert.equal(getExistingInvitationState({ status: "rejected" }, now), null);
  assert.equal(getExistingInvitationState(null, now), null);
});

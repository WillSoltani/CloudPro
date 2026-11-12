import test from "node:test";
import assert from "node:assert/strict";
import { isIssuedRawKey, rawKeyPrefix } from "../../app/api/_lib/raw-key";

const SUB = "6f1c2d3e-0000-4000-8000-000000000001";
const GUEST = "guest-7a8b9c0d-0000-4000-8000-000000000002";
const PROJECT = "3c4d5e6f-0000-4000-8000-000000000003";
const FILE = "9a8b7c6d-0000-4000-8000-000000000004";
const key = (sub: string, slug = "will", project = PROJECT, file = FILE) =>
  `${rawKeyPrefix(sub)}${slug}/projects/my-project--${project}/raw/${file}/photo.heic`;

test("accepts the key the uploads route issues to a signed-in user", () => {
  assert.equal(isIssuedRawKey(key(SUB), SUB, PROJECT, FILE), true);
});

test("accepts the key the uploads route issues to a guest", () => {
  const guestKey = `${rawKeyPrefix(GUEST)}guest/projects/guest-conversion-test--${PROJECT}/raw/${FILE}/a.png`;
  assert.equal(isIssuedRawKey(guestKey, GUEST, PROJECT, FILE), true);
});

test("rejects another caller's key", () => {
  assert.equal(isIssuedRawKey(key(GUEST, "guest"), SUB, PROJECT, FILE), false);
  assert.equal(isIssuedRawKey(key(SUB), GUEST, PROJECT, FILE), false);
});

test("rejects a key outside private/<sub>/ or for another project or upload", () => {
  assert.equal(isIssuedRawKey(`outputs/${key(SUB)}`, SUB, PROJECT, FILE), false);
  assert.equal(isIssuedRawKey(`private/${SUB}-x/will/projects/p--${PROJECT}/raw/${FILE}/a.png`, SUB, PROJECT, FILE), false);
  assert.equal(isIssuedRawKey(key(SUB, "will", "other-project"), SUB, PROJECT, FILE), false);
  assert.equal(isIssuedRawKey(key(SUB, "will", PROJECT, "other-file"), SUB, PROJECT, FILE), false);
});

test("rejects empty inputs", () => {
  assert.equal(isIssuedRawKey(key(SUB), "", PROJECT, FILE), false);
  assert.equal(isIssuedRawKey("", SUB, PROJECT, FILE), false);
});

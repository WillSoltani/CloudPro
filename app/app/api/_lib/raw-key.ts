/**
 * Raw upload keys. The uploads route issues
 *   private/<caller sub>/<user slug>/projects/<project slug>--<projectId>/raw/<fileId>/<filename>
 * where the caller's sub is the Cognito sub, or guest-<session id> for a guest; the complete route only
 * registers a key it could have issued for that caller, project and upload (facts F6). Pure, so it is
 * unit-tested (app/tests/raw-key).
 */
export function rawKeyPrefix(sub: string): string {
  return `private/${sub}/`;
}

/** True when `key` sits under the caller's own prefix, in this project's raw folder, for this upload. */
export function isIssuedRawKey(key: string, sub: string, projectId: string, fileId: string): boolean {
  if (!sub || !projectId || !fileId) return false;
  return key.startsWith(rawKeyPrefix(sub)) && key.includes(`--${projectId}/raw/${fileId}/`);
}

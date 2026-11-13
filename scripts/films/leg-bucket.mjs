/**
 * The per-leg bucket a gate event is counted in. `legs` holds one bucket per measured leg plus `between`, which
 * collects whatever falls outside a measured leg (the gaps between legs, and the late requests, console lines and
 * responses that arrive after the last leg has closed, while the script waits for its size jobs and closes the
 * context). `between` is never reported. Any phase name without a bucket of its own, "done" included, lands there,
 * so a handler can index the legs without ever reaching for a bucket that does not exist.
 */
export function legBucket(legs, phase) {
  return Object.prototype.hasOwnProperty.call(legs, phase) ? legs[phase] : legs.between;
}

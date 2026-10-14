let invalidate: () => void = () => undefined;

export function registerSessionInvalidation(callback: () => void) {
  invalidate = callback;
  return () => { invalidate = () => undefined; };
}

export function runSessionInvalidation() {
  invalidate();
}

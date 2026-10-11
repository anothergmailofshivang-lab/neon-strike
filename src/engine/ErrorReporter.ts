export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function reportError(context: string, error: unknown): string {
  const message = `${context}: ${getErrorMessage(error)}`;
  console.error(`[NEON STRIKE] ${message}`, error);
  return message;
}

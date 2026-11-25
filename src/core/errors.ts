export type AvatarErrorCode =
  | "INVALID_CONFIG"
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "UPLOAD_FAILED"
  | "REMOVE_FAILED"
  | "SIGN_FAILED"
  | "SAVE_FAILED"
  | "LOAD_FAILED"
  | "FORBIDDEN";

export class AvatarKitError extends Error {
  readonly code: AvatarErrorCode;

  constructor(code: AvatarErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AvatarKitError";
    this.code = code;
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AvatarKitError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

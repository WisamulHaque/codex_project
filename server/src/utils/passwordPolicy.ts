import { AppError } from "./appError";

export function ensureStrongPassword(password: string) {
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (password.length < 8 || !hasNumber || !hasSpecial) {
    throw new AppError(
      "Your password must include at least 8 characters, a number, and a special character.",
      400
    );
  }
}

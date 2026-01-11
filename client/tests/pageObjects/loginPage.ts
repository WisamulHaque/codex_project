// Page Object Model for login flows.
export class LoginPage {
  readonly emailInput = "[data-testid='login-email']";
  readonly passwordInput = "[data-testid='login-password']";
  readonly submitButton = "[data-testid='login-submit']";
  readonly googleButton = "button:has-text('Sign in with Google')";
  readonly createAccountButton = "button:has-text('Create One')";
  readonly forgotPasswordLink = "button:has-text('Forgot Password?')";
}

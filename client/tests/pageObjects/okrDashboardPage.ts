// Page Object Model for future UI automation (Playwright/Cypress).
export class OkrDashboardPage {
  readonly objectiveCards = "[data-testid='okr-card']";
  readonly summaryCard = "[data-testid='okr-summary']";
  readonly newOkrButton = "button:has-text('New OKR')";
  readonly assignOkrButton = "button:has-text('Assign OKR')";

  getObjectiveCard(index: number) {
    return `${this.objectiveCards}:nth-of-type(${index + 1})`;
  }
}

// Barrel export for P0.10 email templates.
// Status: 6 templates DRAFT — TFP-style.
// Integration into endpoints: Wave 3 (BACKLOG P0.10).
// Final copywriting: pending заказчик (OPEN_QUESTIONS_P0.md #2).

export { renderVerificationEmail } from "./verification";
export type { VerificationEmailData } from "./verification";

export { renderPaymentConfirmedEmail } from "./payment-confirmed";
export type { PaymentConfirmedEmailData } from "./payment-confirmed";

export { renderChallengePassedEmail } from "./challenge-passed";
export type { ChallengePassedEmailData } from "./challenge-passed";

export { renderChallengeFailedEmail } from "./challenge-failed";
export type { ChallengeFailedEmailData, ChallengeFailReason } from "./challenge-failed";

export { renderPayoutApprovedEmail } from "./payout-approved";
export type { PayoutApprovedEmailData } from "./payout-approved";

export { renderPayoutCompletedEmail } from "./payout-completed";
export type { PayoutCompletedEmailData } from "./payout-completed";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const SCORING_CONFIG = {
  maxScore: 100,
  ticketPenalty: 6,
  negativeSentimentPenalty: 18,
  positiveSentimentBonus: -5,
  inactivityPenaltyPerDay: 0.8,
  renewalPenalty: 8,
  renewalThreshold: 45,
};

function getHealthScore({ usageDrop = 0, openTickets = 0, sentiment = 'neutral', daysInactive = 0, renewalDays = 180 }) {
  const normalizedSentiment = String(sentiment).toLowerCase();
  const sentimentPenalty =
  normalizedSentiment === 'negative'
    ? SCORING_CONFIG.negativeSentimentPenalty
    : normalizedSentiment === 'positive'
    ? SCORING_CONFIG.positiveSentimentBonus
    : 0;
  const inactivityPenalty =
  Math.min(Number(daysInactive) || 0, 30) *
  SCORING_CONFIG.inactivityPenaltyPerDay;
  const renewalPenalty =
  Number(renewalDays) >= 0 &&
  Number(renewalDays) <= SCORING_CONFIG.renewalThreshold
    ? SCORING_CONFIG.renewalPenalty
    : 0;
  const score = clamp(
  Math.round(
    SCORING_CONFIG.maxScore -
    Number(usageDrop) -
    (Number(openTickets) * SCORING_CONFIG.ticketPenalty) -
    sentimentPenalty -
    inactivityPenalty -
    renewalPenalty
  ),
  0,
  SCORING_CONFIG.maxScore
);
  const riskLevel = score < 50 ? 'high' : score < 75 ? 'medium' : 'low';
  return { score, riskLevel };
}

function getRecommendation({ usageDrop = 0, openTickets = 0, sentiment = 'neutral', daysInactive = 0, renewalDays = 180 }) {
  if (Number(usageDrop) >= 25) return { insight: `Product usage fell ${usageDrop}% in the latest period.`, nextStep: 'Schedule a recovery call and review adoption blockers within 24 hours.' };
  if (String(sentiment).toLowerCase() === 'negative' || Number(openTickets) >= 3) return { insight: 'Support activity indicates unresolved customer friction.', nextStep: 'Assign an owner to priority tickets and send a resolution update today.' };
  if (Number(daysInactive) >= 14) return { insight: `Key users have been inactive for ${daysInactive} days.`, nextStep: 'Send a targeted re-engagement and training plan.' };
  if (Number(renewalDays) <= 45) return { insight: 'Renewal is approaching without a strong health buffer.', nextStep: 'Start the renewal-success plan with the account champion.' };
  return { insight: 'Usage and support activity are stable.', nextStep: 'Continue the regular success cadence.' };
}
 
function buildPrompt(customer) {
  return `
You are an AI Customer Success Assistant.

Analyze the customer health summary below and generate actionable insights.

Customer Summary:
- Company: ${customer.companyName || "Unknown"}
- Health Score: ${customer.score}
- Risk Level: ${customer.riskLevel}
- Usage Drop: ${customer.usageDrop}%
- Open Tickets: ${customer.openTickets}
- Sentiment: ${customer.sentiment}
- Days Inactive: ${customer.daysInactive}
- Renewal In: ${customer.renewalDays} days

Instructions:
1. Explain the customer's current health in one sentence.
2. Return the output in exactly this format:

Insight:
<Actionable insight>

Recommendations:
- Recommendation 1
- Recommendation 2
- Recommendation 3

3. Keep every recommendation under 20 words.
4. Do not include extra explanation.
`;
}
module.exports = {
  SCORING_CONFIG,
  getHealthScore,
  getRecommendation,
  buildPrompt,
};
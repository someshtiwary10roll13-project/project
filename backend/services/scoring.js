const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function getHealthScore({ usageDrop = 0, openTickets = 0, sentiment = 'neutral', daysInactive = 0, renewalDays = 180 }) {
  const normalizedSentiment = String(sentiment).toLowerCase();
  const sentimentPenalty = normalizedSentiment === 'negative' ? 18 : normalizedSentiment === 'positive' ? -5 : 0;
  const inactivityPenalty = Math.min(Number(daysInactive) || 0, 30) * 0.8;
  const renewalPenalty = Number(renewalDays) >= 0 && Number(renewalDays) <= 45 ? 8 : 0;
  const score = clamp(Math.round(100 - Number(usageDrop) - (Number(openTickets) * 6) - sentimentPenalty - inactivityPenalty - renewalPenalty), 0, 100);
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
You are a SaaS Customer Success AI assistant.

Customer Health Data:
- Usage Drop: ${customer.usageDrop}%
- Open Tickets: ${customer.openTickets}
- Sentiment: ${customer.sentiment}
- Days Inactive: ${customer.daysInactive}
- Renewal In: ${customer.renewalDays} days

Based on the customer health data above:

1. Explain the churn risk in one sentence.
2. Give at least three actionable next steps.
3. Keep the response clear, concise and professional.
`;
}
module.exports = {
  getHealthScore,
  getRecommendation,
  buildPrompt
};

// Flag internal work copy without rejecting protocol sessions or sequence gaps.
export const internalSurfaceText = [
  /\bdashboard(?:\.html)?\b/i,
  /\bproject[- ]control\b/i,
  /\bbacklog\b/i,
  /\b(?:design|planning|review|work|internal)\s+sessions?\b|\bsessions?\/(?:active|archive)\b|\bsessions?\s+(?:notes|history|index|ledger)\b/i,
  /\b(?:coverage|implementation|conformance|verification)\s+gaps?\b/i,
  /\braw decisions?\b/i,
  /\braw rules?\b/i,
  /\bconformance coverage\b/i,
  /\blocalhost\b/i,
  /\b127\.0\.0\.1\b/,
  /\bdecisions\.jsonl\b/i,
  /\brules\.jsonl\b/i,
];

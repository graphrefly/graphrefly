// vendorStats (B139 brief section 3): Welford over one vendor's ordered amounts, the current
// transaction included, then the sample standard deviation. The same algorithm as TS
// examples/spending-alerts/pipeline.ts. This file is the target of the S1 and S2 source
// edits, so it holds nothing else.

export function vendorStats(amounts) {
  let count = 0;
  let mean = 0;
  let m2 = 0;
  for (const x of amounts) {
    const delta = x - mean;
    count += 1;
    mean += delta / count;
    m2 = m2 + delta * (x - mean);
  }
  const std = count >= 2 ? Math.sqrt(m2 / (count - 1)) : 0;
  return { count, mean, std };
}

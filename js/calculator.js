// js/calculator.js

export function getEffectiveReadLength(cycles, mode) {
  return mode === "PE" ? Math.floor(cycles / 2) : cycles;
}

export function calculateGigabasesFromCycles(cycles, mode, readsMillions) {
  const readLength = getEffectiveReadLength(cycles, mode);
  const readsTotal = readsMillions * 1_000_000;
  const basesPerRead = mode === "PE" ? readLength * 2 : readLength;
  const totalBases = readsTotal * basesPerRead;
  return Math.round((totalBases / 1_000_000_000) * 100) / 100;
}

export function calculateSampleCapacity(totalGb, targetSizeGb, desiredCoverage) {
  if (!targetSizeGb || targetSizeGb <= 0 || !desiredCoverage || desiredCoverage <= 0) {
    return { samples: 0, gbPerSample: 0, remainingGb: totalGb };
  }
  
  const gbPerSample = targetSizeGb * desiredCoverage;
  const samples = Math.floor(totalGb / gbPerSample);
  const remainingGb = Math.round((totalGb - samples * gbPerSample) * 100) / 100;
  
  return { samples, gbPerSample: Math.round(gbPerSample * 100) / 100, remainingGb };
}

export function calculateAchievedCoverage(totalGb, targetSizeGb, numSamples) {
  if (!targetSizeGb || targetSizeGb <= 0 || !numSamples || numSamples <= 0) return 0;
  const gbPerSample = totalGb / numSamples;
  const coverage = gbPerSample / targetSizeGb;
  return Math.round(coverage * 10) / 10;
}
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

export function calculateEffectiveGb(totalGb, pctDuplicates, pctQ30) {
  const dupFactor = 1 - (pctDuplicates / 100);
  const q30Factor = pctQ30 / 100;
  return Math.round(totalGb * dupFactor * q30Factor * 100) / 100;
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

export function ngToNmol(ngPerUl, fragmentLengthBp) {
  if (!ngPerUl || !fragmentLengthBp || fragmentLengthBp <= 0) return 0;
  const mw = fragmentLengthBp * 660;
  const nmolPerL = (ngPerUl * 1_000_000) / mw;
  return Math.round(nmolPerL * 100) / 100;
}

export function calculateDilution(stockConcentration, targetConcentration, stockVolume) {
  if (!stockConcentration || !targetConcentration || !stockVolume) return null;
  if (targetConcentration > stockConcentration) return { error: "Целевая > стока!" };
  if (targetConcentration <= 0) return { error: "Целевая концентрация должна быть > 0" };
  
  // Ваша формула: буфер = сток * (сток_нМ / целевой_нМ - 1)
  const dilutionFactor = (stockConcentration / targetConcentration) - 1;
  const bufferVolume = dilutionFactor * stockVolume;
  const finalVolume = stockVolume + bufferVolume;
  
  return {
    bufferVolume: Math.round(bufferVolume * 100) / 100,
    finalVolume: Math.round(finalVolume * 100) / 100,
    stockVolume: stockVolume,
    dilutionFactor: Math.round((stockConcentration / targetConcentration) * 100) / 100
  };
}

export function calculateFromMode(mode, inputs, totalGb, totalReadsM) {
  let samples = 0, remaining = "", usedPerSample = "", infoText = "";

  switch(mode) {
    case 'size_cov': {
      const sizeGb = inputs.unit === 'Gb' ? inputs.size : inputs.size / 1000;
      const reqGb = sizeGb * inputs.cov;
      samples = Math.floor(totalGb / reqGb);
      remaining = (totalGb - samples * reqGb).toFixed(3) + ' Гб';
      usedPerSample = reqGb.toFixed(3) + ' Гб';
      infoText = `Целевое покрытие: ${inputs.cov}X`;
      break;
    }
    case 'amplicons': {
      const readsNeeded = inputs.ampCount * inputs.ampCov;
      const readsNeededM = readsNeeded / 1_000_000;
      samples = Math.floor(totalReadsM / readsNeededM);
      remaining = (totalReadsM - samples * readsNeededM).toFixed(1) + ' млн ридов';
      usedPerSample = readsNeededM.toFixed(2) + ' млн ридов';
      infoText = `Ридов на образец: ${readsNeeded.toLocaleString()}`;
      break;
    }
    case 'data': {
      const reqGb = inputs.unit === 'Gb' ? inputs.size : inputs.size / 1000;
      samples = Math.floor(totalGb / reqGb);
      remaining = (totalGb - samples * reqGb).toFixed(3) + ' Гб';
      usedPerSample = reqGb.toFixed(3) + ' Гб';
      infoText = "Фиксированный объём данных";
      break;
    }
    case 'reads': {
      samples = Math.floor(totalReadsM / inputs.reads);
      remaining = (totalReadsM - samples * inputs.reads).toFixed(1) + ' млн ридов';
      usedPerSample = inputs.reads + ' млн ридов';
      infoText = "Расчёт по ридам";
      break;
    }
  }
  return { samples, remaining, usedPerSample, infoText };
}

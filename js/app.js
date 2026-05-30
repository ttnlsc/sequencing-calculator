import { platforms } from './data.js';
import { 
  calculateGigabasesFromCycles, 
  calculateSampleCapacity, 
  calculateAchievedCoverage,
  getEffectiveReadLength 
} from './calculator.js';

// Безопасный поиск элементов + логирование при ошибке
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.error(`🔍 ОШИБКА: в HTML нет элемента с id="${id}"`);
  return el;
}

const els = {
  platform: getEl('platform'),
  instrument: getEl('instrument'),
  flowcell: getEl('flowcell'),
  cycles: getEl('cycles'),
  mode: getEl('mode'),
  readLenDisplay: getEl('readLengthDisplay'),
  targetSizeGb: getEl('targetSizeGb'),
  desiredCoverage: getEl('desiredCoverage'),
  calcBtn: getEl('calcBtn'),
  output: getEl('output'),
  resTotalGb: getEl('res-total-gb'),
  resReadLen: getEl('res-readlen'),
  resGbPerSample: getEl('res-gb-per-sample'),
  resCoverageInput: getEl('res-coverage-input'),
  resSamples: getEl('res-samples'),
  resRemaining: getEl('res-remaining'),
  remainingRow: getEl('remaining-row'),
  reverseRow: getEl('reverse-row'),
  resCustomSamples: getEl('res-custom-samples'),
  resAchievedCoverage: getEl('res-achieved-coverage')
};

function init() {
  // Проверка, что всё загрузилось
  if (!els.platform || !els.instrument) {
    console.error('❌ Не удалось найти поля формы. Проверьте структуру файлов.');
    return;
  }

  // Заполняем платформу
  try {
    for (const [key, p] of Object.entries(platforms)) {
      const opt = document.createElement('option');
      opt.value = key; 
      opt.textContent = p.name;
      els.platform.appendChild(opt);
    }
    console.log('✅ Платформы загружены:', Object.keys(platforms));
  } catch (e) {
    console.error('❌ Ошибка загрузки data.js:', e);
    return;
  }

  // Вешаем обработчики
  els.platform.addEventListener('change', updateInstruments);
  els.instrument.addEventListener('change', updateFlowcells);
  els.flowcell.addEventListener('change', updateCycles);
  els.cycles.addEventListener('change', updateReadLengthPreview);
  els.mode.addEventListener('change', updateReadLengthPreview);
  
  // Авто-расчёт при изменениях
  [els.cycles, els.mode, els.targetSizeGb, els.desiredCoverage].forEach(el => {
    if (el) el.addEventListener('input', calculate);
  });
  if (els.calcBtn) els.calcBtn.addEventListener('click', calculate);
}

function updateInstruments() {
  const p = platforms[els.platform.value];
  if (!p) return;
  
  els.instrument.innerHTML = '<option value="">Выберите...</option>';
  els.flowcell.innerHTML = '<option value="">Сначала выберите инструмент</option>';
  els.flowcell.disabled = true;
  els.cycles.disabled = true;
  
  for (const name of Object.keys(p.instruments)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    els.instrument.appendChild(opt);
  }
  els.instrument.disabled = false;
}

function updateFlowcells() {
  const p = platforms[els.platform.value];
  const inst = p.instruments[els.instrument.value];
  if (!inst) return;

  els.flowcell.innerHTML = '<option value="">Выберите...</option>';
  els.cycles.innerHTML = '<option value="">Сначала выберите flow cell</option>';
  els.cycles.disabled = true;
  
  for (const [name, data] of Object.entries(inst.flowcells)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (~${data.reads_millions} млн ридов)`;
    els.flowcell.appendChild(opt);
  }
  els.flowcell.disabled = false;
}

function updateCycles() {
  const p = platforms[els.platform.value];
  const inst = p.instruments[els.instrument.value];
  const fc = inst.flowcells[els.flowcell.value];
  if (!fc) return;
  
  els.cycles.innerHTML = '<option value="">Выберите циклы</option>';
  for (const cyc of fc.cycles) {
    const opt = document.createElement('option');
    opt.value = cyc; opt.textContent = `${cyc} циклов`;
    els.cycles.appendChild(opt);
  }
  els.cycles.disabled = false;
  updateReadLengthPreview();
}

function updateReadLengthPreview() {
  const cyc = parseInt(els.cycles.value) || 0;
  const mode = els.mode.value;
  if (cyc > 0) {
    const len = getEffectiveReadLength(cyc, mode);
    els.readLenDisplay.textContent = `${mode === "PE" ? `PE ${len}+${len}` : `SE ${len}`} п.н.`;
  } else {
    els.readLenDisplay.textContent = "— п.н.";
  }
  calculate();
}

function calculate() {
  const cyc = parseInt(els.cycles.value);
  const mode = els.mode.value;
  const targetSizeGb = parseFloat(els.targetSizeGb.value) || null;
  const desiredCoverage = parseFloat(els.desiredCoverage.value) || null;
  
  if (!cyc || !els.output) {
    if (els.output) els.output.style.display = 'none';
    return;
  }
  
  const fcName = els.flowcell.value;
  const p = platforms[els.platform.value];
  const fc = p.instruments[els.instrument.value].flowcells[fcName];
  if (!fc) return;
  
  const readsMillions = fc.reads_millions;
  const totalGb = calculateGigabasesFromCycles(cyc, mode, readsMillions);
  const readLen = getEffectiveReadLength(cyc, mode);
  
  els.resTotalGb.textContent = totalGb;
  els.resReadLen.textContent = readLen;
  
  if (targetSizeGb && targetSizeGb > 0 && desiredCoverage && desiredCoverage > 0) {
    const { samples, gbPerSample, remainingGb } = calculateSampleCapacity(totalGb, targetSizeGb, desiredCoverage);
    
    els.resGbPerSample.textContent = gbPerSample;
    els.resCoverageInput.textContent = desiredCoverage;
    els.resSamples.textContent = samples;
    els.resRemaining.textContent = remainingGb;
    
    if (samples > 0) {
      els.resCustomSamples.textContent = samples;
      els.resAchievedCoverage.textContent = calculateAchievedCoverage(totalGb, targetSizeGb, samples);
      els.reverseRow.style.display = 'block';
    } else {
      els.reverseRow.style.display = 'none';
    }
    
    els.output.style.display = 'block';
  } else {
    els.output.style.display = 'block';
    els.resGbPerSample.textContent = "—";
    els.resCoverageInput.textContent = "—";
    els.resSamples.textContent = "—";
    els.resRemaining.textContent = "—";
    els.reverseRow.style.display = 'none';
  }
}

// Запуск после загрузки DOM
document.addEventListener('DOMContentLoaded', init);
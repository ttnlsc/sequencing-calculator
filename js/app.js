// js/app.js
import { platforms } from './data.js';
import { calculateGigabasesFromCycles, calculateSampleCapacity, calculateAchievedCoverage, getEffectiveReadLength } from './calculator.js';

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.error(`🔍 DOM ERROR: элемент id="${id}" отсутствует в HTML!`);
  return el;
}

const els = {
  platform: getEl('platform'), instrument: getEl('instrument'), flowcell: getEl('flowcell'),
  cycles: getEl('cycles'), mode: getEl('mode'), readLenDisplay: getEl('readLengthDisplay'),
  targetSizeInput: getEl('targetSizeInput'), targetUnit: getEl('targetUnit'), targetHint: getEl('targetHint'),
  coverageGroup: getEl('coverageGroup'), desiredCoverage: getEl('desiredCoverage'),
  calcBtn: getEl('calcBtn'), output: getEl('output'), resTotalGb: getEl('res-total-gb'),
  resReadLen: getEl('res-readlen'), resGbPerSample: getEl('res-gb-per-sample'),
  resCoverageInput: getEl('res-coverage-input'), resSamples: getEl('res-samples'),
  resRemaining: getEl('res-remaining'), reverseRow: getEl('reverse-row'),
  resCustomSamples: getEl('res-custom-samples'), resAchievedCoverage: getEl('res-achieved-coverage')
};

function showError(msg) {
  console.error('❌', msg);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fee;color:#b00;padding:1rem;text-align:center;z-index:9999;font-weight:bold;';
  banner.textContent = `⚠️ Ошибка загрузки: ${msg}. Проверьте консоль (F12).`;
  document.body.prepend(banner);
}

function convertToGb(value, unit, readLen, mode) {
  if (!value || value <= 0) return 0;
  if (unit === 'Mb') return value / 1000;
  if (unit === 'Gb') return value;
  if (unit === 'Mreads') {
    const basesPerRead = mode === 'PE' ? readLen * 2 : readLen;
    return (value * 1_000_000 * basesPerRead) / 1_000_000_000;
  }
  return 0;
}

function updateHint() {
  const u = els.targetUnit?.value;
  const hints = {
    'Mb': '💡 1 Мб = 0.001 Гб. Для WGS (~3.2 Гб) введите 3200',
    'Gb': '💡 Для WGS человека введите ~3.2',
    'Mreads': '💡 Введите требуемое кол-во ридов на образец (покрытие не нужно)'
  };
  if (els.targetHint) els.targetHint.textContent = hints[u] || '';
}

try {
  console.log('🚀 Запуск NGS Calculator...');
  if (!els.platform || !els.instrument || !els.mode) {
    throw new Error('Критические элементы формы не найдены в HTML. Проверьте id.');
  }

  // Заполняем платформу
  for (const [key, p] of Object.entries(platforms)) {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = p.name;
    els.platform.appendChild(opt);
  }

  // Привязываем события
  els.platform.addEventListener('change', updateInstruments);
  els.instrument.addEventListener('change', updateFlowcells);
  els.flowcell.addEventListener('change', updateCycles);
  els.cycles.addEventListener('change', updateReadLengthPreview);
  els.mode.addEventListener('change', () => { updateReadLengthPreview(); calculate(); });
  els.targetUnit.addEventListener('change', () => { updateHint(); calculate(); });
  [els.cycles, els.mode, els.targetSizeInput, els.desiredCoverage].forEach(el => {
    if (el) el.addEventListener('input', calculate);
  });
  if (els.calcBtn) els.calcBtn.addEventListener('click', calculate);

  // Инициализация по умолчанию
  els.platform.value = els.platform.options[0].value;
  updateInstruments();
  
  // Асинхронная цепочка для гарантии отрисовки
  setTimeout(() => {
    if (els.instrument.options.length > 1) { els.instrument.value = els.instrument.options[1].value; updateFlowcells(); }
    setTimeout(() => {
      if (els.flowcell.options.length > 1) { els.flowcell.value = els.flowcell.options[1].value; updateCycles(); }
      setTimeout(() => {
        if (els.cycles.options.length > 1) { els.cycles.value = els.cycles.options[1].value; updateReadLengthPreview(); }
        console.log('✅ Инициализация завершена успешно');
      }, 50);
    }, 50);
  }, 50);

  // --- Внутренние функции ---
  function updateInstruments() {
    const p = platforms[els.platform.value]; if (!p) return;
    els.instrument.innerHTML = '<option value="">Выберите...</option>';
    els.flowcell.innerHTML = '<option value="">Сначала выберите инструмент</option>'; els.flowcell.disabled = true;
    els.cycles.disabled = true;
    for (const name of Object.keys(p.instruments)) {
      const opt = document.createElement('option'); opt.value = name; opt.textContent = name;
      els.instrument.appendChild(opt);
    }
    els.instrument.disabled = false;
  }

  function updateFlowcells() {
    const p = platforms[els.platform.value]; const inst = p.instruments[els.instrument.value]; if (!inst) return;
    els.flowcell.innerHTML = '<option value="">Выберите...</option>';
    els.cycles.innerHTML = '<option value="">Сначала выберите flow cell</option>'; els.cycles.disabled = true;
    for (const [name, data] of Object.entries(inst.flowcells)) {
      const opt = document.createElement('option'); opt.value = name; opt.textContent = `${name} (~${data.reads_millions}M)`;
      els.flowcell.appendChild(opt);
    }
    els.flowcell.disabled = false;
  }

  function updateCycles() {
    const p = platforms[els.platform.value]; const inst = p.instruments[els.instrument.value];
    const fc = inst.flowcells[els.flowcell.value]; if (!fc) return;
    els.cycles.innerHTML = '<option value="">Выберите циклы</option>';
    for (const cyc of fc.cycles) {
      const opt = document.createElement('option'); opt.value = cyc; opt.textContent = `${cyc} циклов`;
      els.cycles.appendChild(opt);
    }
    els.cycles.disabled = false; updateReadLengthPreview();
  }

  function updateReadLengthPreview() {
    const cyc = parseInt(els.cycles.value) || 0; const mode = els.mode.value;
    if (cyc > 0) {
      const len = getEffectiveReadLength(cyc, mode);
      els.readLenDisplay.innerHTML = `${mode === "PE" ? `PE ${len}+${len}` : `SE ${len}`} п.н.<small>Расчётная длина рида</small>`;
    } else {
      els.readLenDisplay.innerHTML = `— п.н.<small>Расчётная длина рида</small>`;
    }
    calculate();
  }

  function calculate() {
    const cyc = parseInt(els.cycles.value); const mode = els.mode.value;
    const rawSize = parseFloat(els.targetSizeInput.value) || 0;
    const unit = els.targetUnit.value;
    const desiredCoverage = parseFloat(els.desiredCoverage.value) || null;

    if (!cyc || !els.output) { if(els.output) els.output.style.display = 'none'; return; }

    const fcName = els.flowcell.value; const p = platforms[els.platform.value];
    const fc = p.instruments[els.instrument.value].flowcells[fcName]; if (!fc) return;

    const readsMillions = fc.reads_millions;
    const totalGb = calculateGigabasesFromCycles(cyc, mode, readsMillions);
    const readLen = getEffectiveReadLength(cyc, mode);

    els.resTotalGb.textContent = totalGb + ' Гб';
    els.resReadLen.textContent = readLen + ' п.н.';

    if (unit === 'Mreads') {
      els.coverageGroup.style.display = 'none';
      if (rawSize > 0) {
        const samples = Math.floor(readsMillions / rawSize);
        const rem = (readsMillions % rawSize).toFixed(1);
        els.resGbPerSample.textContent = `${rawSize} млн ридов`;
        els.resCoverageInput.textContent = '—';
        els.resSamples.textContent = samples;
        els.resRemaining.textContent = `${rem} млн ридов`;
        els.reverseRow.style.display = 'none';
      }
    } else {
      els.coverageGroup.style.display = 'block';
      if (rawSize > 0 && desiredCoverage && desiredCoverage > 0) {
        const targetSizeGb = convertToGb(rawSize, unit, readLen, mode);
        const { samples, gbPerSample, remainingGb } = calculateSampleCapacity(totalGb, targetSizeGb, desiredCoverage);
        els.resGbPerSample.textContent = gbPerSample + ' Гб';
        els.resCoverageInput.textContent = desiredCoverage;
        els.resSamples.textContent = samples;
        els.resRemaining.textContent = remainingGb + ' Гб';
        if (samples > 0) {
          els.resCustomSamples.textContent = samples;
          els.resAchievedCoverage.textContent = calculateAchievedCoverage(totalGb, targetSizeGb, samples);
          els.reverseRow.style.display = 'block';
        } else { els.reverseRow.style.display = 'none'; }
      } else {
        els.resGbPerSample.textContent = '—'; els.resCoverageInput.textContent = '—';
        els.resSamples.textContent = '—'; els.resRemaining.textContent = '—'; els.reverseRow.style.display = 'none';
      }
    }
    els.output.style.display = 'block';
  }

} catch (err) {
  showError(err.message);
}
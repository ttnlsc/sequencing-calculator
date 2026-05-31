import { platforms } from './data.js';
import { 
  calculateGigabasesFromCycles, 
  calculateSampleCapacity, 
  calculateAchievedCoverage, 
  getEffectiveReadLength,
  calculateEffectiveGb,
  ngToNmol,
  calculateDilution,
  calculateFromMode
} from './calculator.js';

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.error(`🔍 DOM ERROR: элемент id="${id}" отсутствует в HTML!`);
  return el;
}

const els = {
  platform: getEl('platform'), instrument: getEl('instrument'), flowcell: getEl('flowcell'),
  cycles: getEl('cycles'), mode: getEl('mode'), readLenDisplay: getEl('readLengthDisplay'),
  planMode: getEl('planMode'), modeHint: getEl('modeHint'),
  panelSize: getEl('panelSize'), panelSizeUnit: getEl('panelSizeUnit'), panelCov: getEl('panelCov'),
  panelAmpCount: getEl('panelAmpCount'), panelAmpCov: getEl('panelAmpCov'),
  panelDataSize: getEl('panelDataSize'), panelDataUnit: getEl('panelDataUnit'),
  panelReads: getEl('panelReads'),
    // Доп. параметры (качество)
  advancedToggle: getEl('toggleAdvanced'), advancedPanel: getEl('advancedPanel'),
  pctDuplicates: getEl('pctDuplicates'), pctQ30: getEl('pctQ30'),
  // Кнопка и результаты
  calcBtn: getEl('calcBtn'), output: getEl('output'), 
  resTotalGb: getEl('res-total-gb'), resEffectiveGb: getEl('res-effective-gb'),
  resReadLen: getEl('res-readlen'), resGbPerSample: getEl('res-gb-per-sample'),
  resSamples: getEl('res-samples'), resRemaining: getEl('res-remaining'), 
  reverseRow: getEl('reverse-row'), resCustomSamples: getEl('res-custom-samples'), 
  resAchievedCoverage: getEl('res-achieved-coverage'),
  // Калькулятор молярности
  fragLength: getEl('fragLength'), libConcNg: getEl('libConcNg'), convertBtn: getEl('convertBtn'),
  poolResult: getEl('poolResult'), resNm: getEl('res-nm'), targetNm: getEl('targetNm'),
  diluteBtn: getEl('diluteBtn'), dilutionResult: getEl('dilutionResult'), resVolBuffer: getEl('res-vol-buffer'),
  stockVol: getEl('stockVol'), resVolFinal: getEl('res-vol-final'), resDilFactor: getEl('res-dil-factor'),
  // Сворачивание таблицы
  toggleTable: getEl('toggleTable'), tableContent: getEl('tableContent'),
  // Подготовка к запуску
  runPrepCard: getEl('run-prep-card'), targetLoadingPm: getEl('targetLoadingPm'),
  calcRunBtn: getEl('calcRunBtn'), runPrepResult: getEl('runPrepResult'),
  resLibVol: getEl('res-lib-vol'), resHybVol: getEl('res-hyb-vol')
};

function showError(msg) {
  console.error('❌', msg);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fee;color:#b00;padding:1rem;text-align:center;z-index:9999;font-weight:bold;';
  banner.textContent = `Ошибка загрузки: ${msg}. Проверьте консоль (F12).`;
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

try {
  console.log('Запуск NGS Calculator...');
  if (!els.platform || !els.instrument || !els.mode) {
    throw new Error('Критические элементы формы не найдены в HTML. Проверьте id.');
  }

  // Заполняем платформу
  for (const [key, p] of Object.entries(platforms)) {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = p.name;
    els.platform.appendChild(opt);
  }

  els.platform.addEventListener('change', updateInstruments);
  els.instrument.addEventListener('change', () => { updateFlowcells(); updatePrepCardVisibility(); });
  els.flowcell.addEventListener('change', updateCycles);
  els.cycles.addEventListener('change', updateReadLengthPreview);
  els.mode.addEventListener('change', updateReadLengthPreview);

  // Переключение режимов планирования
  if (els.planMode) {
    els.planMode.addEventListener('change', () => {
      document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
      const activePanel = document.getElementById(`panel-${els.planMode.value}`);
      if (activePanel) activePanel.classList.add('active');
      
      const hints = {
        size_cov: 'Введите размер таргета и желаемое покрытие',
        amplicons: 'Укажите кол-во ампликонов, их среднюю длину и покрытие',
        data: 'Введите объём данных, который вы планируете получить на образец',
        reads: 'Введите количество млн ридов на образец'
      };
      if (els.modeHint) els.modeHint.textContent = hints[els.planMode.value] || '';
    });
  }

  if (els.calcBtn) els.calcBtn.addEventListener('click', calculate);

   // Сворачивание доп. параметров
  if (els.advancedToggle && els.advancedPanel) {
    els.advancedToggle.addEventListener('click', () => {
      els.advancedPanel.classList.toggle('visible');
      const isVis = els.advancedPanel.classList.contains('visible');
      els.advancedToggle.innerHTML = `Дополнительные параметры ${isVis ? '▲' : '▼'}`;
    });
  }
  
  // Сворачивание таблицы
  if (els.toggleTable && els.tableContent) {
    els.toggleTable.addEventListener('click', () => {
      const isHidden = els.tableContent.style.display === 'none';
      els.tableContent.style.display = isHidden ? 'block' : 'none';
      els.toggleTable.querySelector('span').textContent = isHidden ? '▲' : '▼';
    });
  }

  // Калькулятора молярности
  if (els.convertBtn) {
    els.convertBtn.addEventListener('click', () => {
      const ng = parseFloat(els.libConcNg.value) || 0;
      const len = parseFloat(els.fragLength.value) || 0;
      if (ng > 0 && len > 0) {
        const nm = ngToNmol(ng, len);
        els.resNm.textContent = `${nm} нМ`;
        els.poolResult.style.display = 'block';
      }
    });
  }
  
    if (els.diluteBtn) {
    els.diluteBtn.addEventListener('click', () => {
      const stockNmText = els.resNm?.textContent || "0 нМ";
      const stockNm = parseFloat(stockNmText.replace(/[^0-9.]/g, '')) || 0;
      
      const targetNm = parseFloat(els.targetNm.value) || 0;
      const stockVol = parseFloat(els.stockVol.value) || 0; // 🔑 новое поле
      
      if (stockNm <= 0 || targetNm <= 0 || stockVol <= 0) {
        alert('Заполните все поля: молярность, целевую концентрацию и объём стока');
        return;
      }
      
      const res = calculateDilution(stockNm, targetNm, stockVol);
      if (res && !res.error) {
        els.resVolBuffer.textContent = res.bufferVolume;
        els.resVolFinal.textContent = res.finalVolume;
        els.resDilFactor.textContent = res.dilutionFactor + '×';
        els.dilutionResult.style.display = 'block';
      } else if (res?.error) {
        alert(`${res.error}`);
      }
    });
  }

  // Калькулятор второго разведения (для GenoLab M / Геноскан 4000)
  if (els.calcRunBtn) {
    els.calcRunBtn.addEventListener('click', () => {
      const targetPm = parseFloat(els.targetLoadingPm.value) || 0;
      
      if (targetPm > 0) {
        // Формула: V_20pm = (Target_pM × 1500) / 20
        // Итоговый объём всегда 1500 мкл
        const vol20pm = (targetPm * 1500) / 20;
        const volHyb = 1500 - vol20pm;
        
        els.resLibVol.textContent = Math.round(vol20pm * 10) / 10 + ' мкл';
        els.resHybVol.textContent = Math.round(volHyb * 10) / 10 + ' мкл';
        els.runPrepResult.style.display = 'block';
      }
    });
  }

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
        console.log('Инициализация завершена успешно');
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

    // Можно расширять: ['GenoLab M', 'NextSeq 2000', ...]
    const instrumentsWithPrep = ['GenoLab M / Геноскан 4000'];
    const selectedInstrument = els.instrument.value;
    
    if (els.runPrepCard) {
      const showPrep = selectedInstrument && instrumentsWithPrep.includes(selectedInstrument);
      els.runPrepCard.style.display = showPrep ? 'block' : 'none';
      
      // Обновляем заголовок карточки в зависимости от инструмента
      if (showPrep && els.runPrepCard.querySelector('h3')) {
        const platformName = p.name === 'GeneMind' ? 'GenoLab M / Геноскан 4000' : selectedInstrument;
        els.runPrepCard.querySelector('h3').textContent = `Подготовка к запуску (${platformName})`;
      }
    }
  }

  function updatePrepCardVisibility() {
    if (!els.runPrepCard) return;
    const p = platforms[els.platform.value];
    const instrumentsWithPrep = ['GenoLab M / Геноскан 4000'];
    const showPrep = p && instrumentsWithPrep.includes(els.instrument.value);
    els.runPrepCard.style.display = showPrep ? 'block' : 'none';
    
    if (showPrep && els.runPrepCard.querySelector('h3')) {
      els.runPrepCard.querySelector('h3').textContent = `Подготовка к запуску (${els.instrument.value})`;
    }
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
    const cyc = parseInt(els.cycles.value) || 0;
    const mode = els.mode.value;
    const planMode = els.planMode?.value || 'size_cov';
    const pctDup = parseFloat(els.pctDuplicates.value) || 0;
    const pctQ30 = parseFloat(els.pctQ30.value) || 100;

    if (!cyc || !els.output) { if(els.output) els.output.style.display = 'none'; return; }

    const fcName = els.flowcell.value;
    const p = platforms[els.platform.value];
    const fc = p.instruments[els.instrument.value].flowcells[fcName];
    if (!fc) return;

    const totalGbRaw = calculateGigabasesFromCycles(cyc, mode, fc.reads_millions);
    const effectiveGb = calculateEffectiveGb(totalGbRaw, pctDup, pctQ30);
    const readLen = getEffectiveReadLength(cyc, mode);

    // Собираем данные из активной панели
    let inputs = {};
    switch(planMode) {
      case 'size_cov':
        inputs = { size: parseFloat(els.panelSize.value), unit: els.panelSizeUnit.value, cov: parseFloat(els.panelCov.value) };
        break;
      case 'amplicons':
        inputs = { ampCount: parseFloat(els.panelAmpCount.value), ampCov: parseFloat(els.panelAmpCov.value) };
        break;
      case 'data':
        inputs = { size: parseFloat(els.panelDataSize.value), unit: els.panelDataUnit.value };
        break;
      case 'reads':
        inputs = { reads: parseFloat(els.panelReads.value) };
        break;
    }

    // Если ключевые поля пусты → прячем результат
    const isEmpty = planMode === 'reads' ? !inputs.reads : 
                    planMode === 'data' ? !inputs.size :
                    planMode === 'amplicons' ? (!inputs.ampCount || !inputs.ampCov) :
                    (!inputs.size || !inputs.cov);

    if (isEmpty) { els.output.style.display = 'none'; return; }

    // Единый расчёт
    const res = calculateFromMode(planMode, inputs, effectiveGb, fc.reads_millions);

    // Вывод
    els.resTotalGb.textContent = totalGbRaw.toFixed(2) + ' Гб';
    els.resEffectiveGb.textContent = effectiveGb.toFixed(2) + ' Гб';
    els.resReadLen.textContent = readLen + ' п.н.';
    els.resGbPerSample.textContent = res.usedPerSample;
    els.resSamples.textContent = res.samples;
    els.resRemaining.textContent = res.remaining;
    
    // Обратный расчёт покрытия
    if (planMode === 'size_cov' && res.samples > 0) {
      const size = parseFloat(els.panelSize.value) || 0;
      const unit = els.panelSizeUnit.value;
      const panelSizeGb = unit === 'Gb' ? size : size / 1000;

      if (panelSizeGb > 0) {
        const gbPerSample = effectiveGb / res.samples;
        const actualCov = Math.round((gbPerSample / panelSizeGb) * 10) / 10;
        els.reverseRow.style.display = 'block';
        els.resCustomSamples.textContent = res.samples;
        els.resAchievedCoverage.textContent = actualCov;
      }
    } else if (planMode === 'amplicons' && res.samples > 0) {
      const ampCount = parseFloat(els.panelAmpCount.value) || 1;
      const readsPerSample = parseFloat(res.usedPerSample) * 1_000_000 || 0;
      if (readsPerSample > 0 && ampCount > 0) {
        const actualCov = Math.round(readsPerSample / ampCount);
        els.reverseRow.style.display = 'block';
        els.resCustomSamples.textContent = res.samples;
        els.resAchievedCoverage.textContent = actualCov;
      }
    } else {
      els.reverseRow.style.display = 'none';
    }

    els.output.style.display = 'block';
  }

} catch (err) {
  showError(err.message);
}
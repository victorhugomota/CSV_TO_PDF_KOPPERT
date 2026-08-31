/**
 * Controlador Principal da Aplicação Koppert CSV to PDF
 */

import { SensorDataParser } from './parser.js';
import { SensorChartManager } from './chart.js';
import { PDFExportService } from './pdf-export.js';
import { FirebaseHistoryService } from './firebase-service.js';

class App {
  constructor() {
    this.chartManager = null;
    this.pdfService = new PDFExportService();
    this.firebaseService = new FirebaseHistoryService();

    this.currentRawCSV = null;
    this.currentFilename = null;
    this.currentDataset = null;
    this.customLogoBase64 = null;

    this.initElements();
    this.initChart();
    this.bindEvents();
    this.initTheme();
  }

  initElements() {
    // Dropzone e Arquivo
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('file-input');
    this.btnBrowse = document.getElementById('btn-browse-file');
    this.btnLoadSample = document.getElementById('btn-load-sample');

    // Barra de Detalhes
    this.fileInfoBar = document.getElementById('file-info-bar');
    this.infoFilename = document.getElementById('info-filename');
    this.infoRows = document.getElementById('info-rows');
    this.infoSensorCount = document.getElementById('info-sensor-count');
    this.infoTimeRange = document.getElementById('info-time-range');
    this.scaleModeSelect = document.getElementById('scale-mode-select');

    // Seção de Sensores
    this.sensorsSection = document.getElementById('sensors-section');
    this.sensorCategories = document.getElementById('sensor-categories');
    this.btnSelectAll = document.getElementById('btn-select-all');
    this.btnSelectNone = document.getElementById('btn-select-none');
    this.btnFilterTemp = document.getElementById('btn-filter-temp');
    this.btnFilterUmid = document.getElementById('btn-filter-umid');
    this.btnFilterCo2 = document.getElementById('btn-filter-co2');
    this.btnFilterPress = document.getElementById('btn-filter-press');

    // Gráfico e Estatísticas
    this.chartSection = document.getElementById('chart-section');
    this.chartTitle = document.getElementById('chart-main-title');
    this.chartSubtitle = document.getElementById('chart-main-subtitle');
    this.statsTableBody = document.getElementById('stats-table-body');
    this.btnSaveCloud = document.getElementById('btn-save-cloud');
    this.btnOpenPdfDesigner = document.getElementById('btn-open-pdf-designer');

    // Modal PDF
    this.pdfModal = document.getElementById('pdf-modal');
    this.btnClosePdfModal = document.getElementById('btn-close-pdf-modal');
    this.btnCancelPdf = document.getElementById('btn-cancel-pdf');
    this.btnDownloadPdfNow = document.getElementById('btn-download-pdf-now');
    this.btnUploadLogo = document.getElementById('btn-upload-logo');
    this.btnResetLogo = document.getElementById('btn-reset-logo');
    this.pdfLogoInput = document.getElementById('pdf-logo-input');
    
    // Inputs do Designer PDF
    this.pdfTitleInput = document.getElementById('pdf-title-input');
    this.pdfSubtitleInput = document.getElementById('pdf-subtitle-input');
    this.pdfRespInput = document.getElementById('pdf-resp-input');
    this.pdfNotesInput = document.getElementById('pdf-notes-input');
    this.pdfOrientationSelect = document.getElementById('pdf-orientation-select');
    this.pdfMarginV = document.getElementById('pdf-margin-v');
    this.pdfMarginH = document.getElementById('pdf-margin-h');
    this.pdfIncludeTable = document.getElementById('pdf-include-table');

    // Elementos do Mockup da Folha
    this.pageMockup = document.getElementById('page-mockup');
    this.mockupGuide = document.getElementById('mockup-guide');
    this.mockupLogoImg = document.getElementById('mockup-logo-img');
    this.mockupTitleText = document.getElementById('mockup-title-text');
    this.mockupSubtitleText = document.getElementById('mockup-subtitle-text');
    this.mockupStatsArea = document.getElementById('mockup-stats-area');
    this.previewDimLabel = document.getElementById('preview-dim-label');

    // Modal Histórico
    this.historyModal = document.getElementById('history-modal');
    this.btnOpenHistory = document.getElementById('btn-open-history');
    this.btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
    this.btnCloseHistory = document.getElementById('btn-close-history');
    this.historyList = document.getElementById('history-list');

    // Tema
    this.btnToggleTheme = document.getElementById('btn-toggle-theme');
    this.themeIcon = document.getElementById('theme-icon');
  }

  initChart() {
    const chartContainer = document.getElementById('main-chart');
    if (chartContainer) {
      this.chartManager = new SensorChartManager(chartContainer);
    }
  }

  bindEvents() {
    // Upload / Drag and Drop
    this.btnBrowse.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('dragover');
    });

    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('dragover');
    });

    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        this.processFile(e.dataTransfer.files[0]);
      }
    });

    // Carregar Exemplo logs (3).csv
    this.btnLoadSample.addEventListener('click', () => this.loadSampleCSV());

    // Seletor de Escala
    this.scaleModeSelect.addEventListener('change', () => {
      if (this.currentRawCSV) {
        this.parseAndRender(this.currentRawCSV, this.currentFilename);
        this.showToast('Escala de dados atualizada!', 'info');
      }
    });

    // Botões de Seleção Rápida de Sensores
    this.btnSelectAll.addEventListener('click', () => {
      if (!this.currentDataset) return;
      this.chartManager.toggleAll(true);
      this.updateSensorChipsState();
      this.updateStatsTable();
    });

    this.btnSelectNone.addEventListener('click', () => {
      if (!this.currentDataset) return;
      this.chartManager.toggleAll(false);
      this.updateSensorChipsState();
      this.updateStatsTable();
    });

    this.btnFilterTemp.addEventListener('click', () => this.filterByType('temperature'));
    this.btnFilterUmid.addEventListener('click', () => this.filterByType('humidity'));
    this.btnFilterCo2.addEventListener('click', () => this.filterByType('co2'));
    this.btnFilterPress.addEventListener('click', () => this.filterByType('pressure'));

    // Salvar na Nuvem (Firebase)
    this.btnSaveCloud.addEventListener('click', () => this.saveCurrentToCloud());

    // Modal PDF
    this.btnOpenPdfDesigner.addEventListener('click', () => this.openPDFDesigner());
    this.btnClosePdfModal.addEventListener('click', () => this.closePDFDesigner());
    this.btnCancelPdf.addEventListener('click', () => this.closePDFDesigner());
    this.btnDownloadPdfNow.addEventListener('click', () => this.downloadPDF());

    // Interatividade do Mockup do PDF
    this.btnUploadLogo.addEventListener('click', () => this.pdfLogoInput.click());
    this.pdfLogoInput.addEventListener('change', (e) => this.handleCustomLogo(e));
    this.btnResetLogo.addEventListener('click', () => this.resetDefaultLogo());

    this.pdfTitleInput.addEventListener('input', () => this.updatePDFMockup());
    this.pdfSubtitleInput.addEventListener('input', () => this.updatePDFMockup());
    this.pdfOrientationSelect.addEventListener('change', () => this.updatePDFMockup());
    this.pdfMarginV.addEventListener('input', () => this.updatePDFMockup());
    this.pdfMarginH.addEventListener('input', () => this.updatePDFMockup());
    this.pdfIncludeTable.addEventListener('change', () => this.updatePDFMockup());

    // Modal Histórico
    this.btnOpenHistory.addEventListener('click', () => this.openHistoryModal());
    this.btnCloseHistoryModal.addEventListener('click', () => this.closeHistoryModal());
    this.btnCloseHistory.addEventListener('click', () => this.closeHistoryModal());

    // Tema
    this.btnToggleTheme.addEventListener('click', () => this.toggleTheme());
  }

  // Processamento de Arquivos
  handleFileSelect(e) {
    if (e.target.files && e.target.files.length) {
      this.processFile(e.target.files[0]);
    }
  }

  processFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.currentRawCSV = text;
      this.currentFilename = file.name;
      this.parseAndRender(text, file.name);
      this.showToast(`Arquivo "${file.name}" carregado com sucesso!`, 'success');
    };
    reader.readAsText(file);
  }

  async loadSampleCSV() {
    try {
      const response = await fetch('logs (3).csv');
      if (response.ok) {
        const text = await response.text();
        this.currentRawCSV = text;
        this.currentFilename = 'logs (3).csv';
        this.parseAndRender(text, 'logs (3).csv');
        this.showToast('Exemplo logs (3).csv carregado com sucesso!', 'success');
      } else {
        throw new Error('Arquivo local não encontrado via fetch.');
      }
    } catch (err) {
      console.warn('Carregando via fallback embutido:', err);
      this.showToast('Carregando dados de telemetria Koppert...', 'info');
    }
  }

  parseAndRender(csvText, filename) {
    try {
      const scaleMode = this.scaleModeSelect.value;
      const dataset = SensorDataParser.parse(csvText, { scaleMode });
      this.currentDataset = dataset;

      // Atualiza barra de informações
      this.fileInfoBar.style.display = 'flex';
      this.infoFilename.textContent = filename || 'dados.csv';
      this.infoRows.textContent = dataset.totalRows.toLocaleString('pt-BR');
      this.infoSensorCount.textContent = `${dataset.sensors.length} sensores`;
      
      if (dataset.timeRange.start && dataset.timeRange.end) {
        const d1 = new Date(dataset.timeRange.start);
        const d2 = new Date(dataset.timeRange.end);
        this.infoTimeRange.textContent = `${d1.toLocaleDateString('pt-BR')} ${d1.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} até ${d2.toLocaleDateString('pt-BR')} ${d2.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
      } else {
        this.infoTimeRange.textContent = 'Sequencial';
      }

      // Renderiza Seletor de Sensores
      this.renderSensorCategories(dataset.sensors);
      this.sensorsSection.style.display = 'block';

      // Atualiza Gráfico
      this.chartSection.style.display = 'block';
      this.chartTitle.textContent = `Telemetria: ${filename || 'Relatório de Sensores'}`;
      this.chartSubtitle.textContent = `Total de ${dataset.sensors.length} sensores monitorados com ajuste automático de unidades (°C, %, PPM, Pa)`;

      this.chartManager.setDataset(dataset);
      this.updateStatsTable();

      // Salva automaticamente no Firebase
      this.firebaseService.saveChartHistory({
        filename: filename || 'dados.csv',
        totalRows: dataset.totalRows,
        sensors: dataset.sensors,
        csvRaw: csvText
      });

    } catch (err) {
      console.error('Erro ao processar CSV:', err);
      this.showToast(`Erro ao processar CSV: ${err.message}`, 'error');
    }
  }

  // Renderização das Categorias de Sensores
  renderSensorCategories(sensors) {
    this.sensorCategories.innerHTML = '';

    // Agrupa sensores por tipo
    const groups = {};
    sensors.forEach(sensor => {
      if (!groups[sensor.group]) {
        groups[sensor.group] = [];
      }
      groups[sensor.group].push(sensor);
    });

    Object.keys(groups).forEach(groupName => {
      const groupSensors = groups[groupName];
      const card = document.createElement('div');
      card.className = 'sensor-group-card';

      const unitBadge = groupSensors[0] ? groupSensors[0].unit : '';
      card.innerHTML = `
        <div class="sensor-group-title">
          <span>${groupName} ${unitBadge ? `(${unitBadge})` : ''}</span>
          <span class="sensor-group-badge">${groupSensors.length}</span>
        </div>
        <div class="sensor-chips" id="group-chips-${groupName.replace(/\s+/g, '-')}"></div>
      `;

      const chipsContainer = card.querySelector('.sensor-chips');

      groupSensors.forEach(sensor => {
        const chip = document.createElement('div');
        chip.className = `sensor-chip ${sensor.enabled ? 'active' : ''}`;
        chip.id = `chip-${sensor.id}`;
        chip.innerHTML = `
          <div class="sensor-chip-info">
            <span class="sensor-color-indicator" style="background-color: ${sensor.color};"></span>
            <span class="sensor-name" title="${sensor.name}">${sensor.name}</span>
          </div>
          <span class="sensor-unit-badge">${sensor.unit}</span>
        `;

        chip.addEventListener('click', () => {
          sensor.enabled = !sensor.enabled;
          chip.classList.toggle('active', sensor.enabled);
          this.chartManager.toggleSensor(sensor.id, sensor.enabled);
          this.updateStatsTable();
        });

        chipsContainer.appendChild(chip);
      });

      this.sensorCategories.appendChild(card);
    });
  }

  updateSensorChipsState() {
    if (!this.currentDataset) return;
    this.currentDataset.sensors.forEach(sensor => {
      const chip = document.getElementById(`chip-${sensor.id}`);
      if (chip) {
        chip.classList.toggle('active', sensor.enabled);
      }
    });
  }

  filterByType(targetType) {
    if (!this.currentDataset) return;
    this.currentDataset.sensors.forEach(sensor => {
      sensor.enabled = sensor.type === targetType;
    });
    this.chartManager.render();
    this.updateSensorChipsState();
    this.updateStatsTable();
  }

  // Tabela de Resumo Estatístico
  updateStatsTable() {
    if (!this.currentDataset) return;
    this.statsTableBody.innerHTML = '';

    const activeSensors = this.currentDataset.sensors.filter(s => s.enabled);
    if (activeSensors.length === 0) {
      this.statsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Nenhum sensor selecionado.</td></tr>`;
      return;
    }

    activeSensors.forEach(sensor => {
      const tr = document.createElement('tr');
      const stats = sensor.stats || { min: 0, max: 0, avg: 0, last: 0 };
      
      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="width:10px; height:10px; border-radius:2px; background:${sensor.color}; display:inline-block;"></span>
            <strong>${sensor.name}</strong>
          </div>
        </td>
        <td>${sensor.group}</td>
        <td><strong>${sensor.unit || '-'}</strong></td>
        <td>${stats.min.toFixed(2)} ${sensor.unit}</td>
        <td>${stats.max.toFixed(2)} ${sensor.unit}</td>
        <td>${stats.avg.toFixed(2)} ${sensor.unit}</td>
        <td><strong>${stats.last.toFixed(2)} ${sensor.unit}</strong></td>
      `;
      this.statsTableBody.appendChild(tr);
    });
  }

  // Firebase
  async saveCurrentToCloud() {
    if (!this.currentDataset) {
      this.showToast('Nenhum dado carregado para salvar!', 'warning');
      return;
    }
    this.showToast('Salvando gráfico no Firebase Firestore...', 'info');
    const res = await this.firebaseService.saveChartHistory({
      filename: this.currentFilename || 'dados_telemetria.csv',
      totalRows: this.currentDataset.totalRows,
      sensors: this.currentDataset.sensors,
      csvRaw: this.currentRawCSV
    });

    if (res.success) {
      this.showToast('Gráfico e metadados salvos na nuvem com sucesso!', 'success');
    }
  }

  async openHistoryModal() {
    this.historyModal.classList.add('open');
    this.historyList.innerHTML = `<div class="empty-state">Carregando histórico do Firebase...</div>`;

    const items = await this.firebaseService.loadHistory();
    if (!items || items.length === 0) {
      this.historyList.innerHTML = `<div class="empty-state">Nenhum gráfico salvo no histórico ainda. Importe um arquivo CSV para começar!</div>`;
      return;
    }

    this.historyList.innerHTML = '';
    items.forEach(item => {
      const date = new Date(item.createdAt);
      const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-details">
          <h4>${item.filename}</h4>
          <p>${dateStr} &bull; ${item.totalRows || 0} registros &bull; ${item.sensorCount || (item.sensorsSummary ? item.sensorsSummary.length : 0)} sensores</p>
        </div>
        <div class="history-actions">
          <button class="btn btn-primary btn-sm btn-load-hist">Carregar</button>
          <button class="btn btn-outline btn-sm btn-del-hist" title="Excluir">✕</button>
        </div>
      `;

      div.querySelector('.btn-load-hist').addEventListener('click', () => {
        if (item.csvData) {
          this.currentRawCSV = item.csvData;
          this.currentFilename = item.filename;
          this.parseAndRender(item.csvData, item.filename);
          this.closeHistoryModal();
          this.showToast(`Gráfico "${item.filename}" carregado do histórico!`, 'success');
        } else {
          this.showToast('Os dados brutos deste registro não estão disponíveis para re-renderização.', 'warning');
        }
      });

      div.querySelector('.btn-del-hist').addEventListener('click', async () => {
        await this.firebaseService.deleteItem(item.id, item.source);
        div.remove();
        this.showToast('Item excluído do histórico.', 'info');
      });

      this.historyList.appendChild(div);
    });
  }

  closeHistoryModal() {
    this.historyModal.classList.remove('open');
  }

  // Designer e Exportação de PDF
  openPDFDesigner() {
    this.mockupLogoImg.src = this.customLogoBase64 || this.pdfService.defaultLogo;
    this.updatePDFMockup();
    this.pdfModal.classList.add('open');
  }

  closePDFDesigner() {
    this.pdfModal.classList.remove('open');
  }

  handleCustomLogo(e) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.customLogoBase64 = ev.target.result;
        this.mockupLogoImg.src = this.customLogoBase64;
        this.showToast('Foto do cabeçalho atualizada!', 'success');
      };
      reader.readAsDataURL(file);
    }
  }

  resetDefaultLogo() {
    this.customLogoBase64 = null;
    this.mockupLogoImg.src = this.pdfService.defaultLogo;
    this.showToast('Logo padrão Koppert restaurado.', 'info');
  }

  updatePDFMockup() {
    const orientation = this.pdfOrientationSelect.value;
    const title = this.pdfTitleInput.value || 'RELATÓRIO DE TELEMETRIA';
    const subtitle = this.pdfSubtitleInput.value || 'Koppert Biological Systems';
    const marginV = Math.max(5, Math.min(30, parseInt(this.pdfMarginV.value) || 12));
    const marginH = Math.max(5, Math.min(30, parseInt(this.pdfMarginH.value) || 15));
    const showTable = this.pdfIncludeTable.checked;

    // Atualiza classes e dimensões
    if (orientation === 'portrait') {
      this.pageMockup.classList.add('portrait');
      this.previewDimLabel.textContent = 'Retrato (210 x 297 mm)';
    } else {
      this.pageMockup.classList.remove('portrait');
      this.previewDimLabel.textContent = 'Paisagem (297 x 210 mm)';
    }

    // Atualiza guias de margens proporcionais no CSS
    const scaleFactor = orientation === 'portrait' ? 1.0 : 1.35;
    this.pageMockup.style.setProperty('--mock-mt', `${marginV * scaleFactor}px`);
    this.pageMockup.style.setProperty('--mock-mb', `${marginV * scaleFactor}px`);
    this.pageMockup.style.setProperty('--mock-ml', `${marginH * scaleFactor}px`);
    this.pageMockup.style.setProperty('--mock-mr', `${marginH * scaleFactor}px`);

    this.mockupTitleText.textContent = title;
    this.mockupSubtitleText.textContent = subtitle;
    this.mockupStatsArea.style.display = showTable ? 'block' : 'none';

    // Atualiza thumbnail do gráfico no mockup
    const chartImg = this.chartManager ? this.chartManager.getImageDataURL() : null;
    const mockupChartArea = document.getElementById('mockup-chart-area');
    if (chartImg && mockupChartArea) {
      mockupChartArea.innerHTML = `<img src="${chartImg}" alt="Gráfico">`;
    }
  }

  async downloadPDF() {
    try {
      this.showToast('Gerando relatório corporativo em PDF...', 'info');
      
      const options = {
        title: this.pdfTitleInput.value,
        subtitle: this.pdfSubtitleInput.value,
        responsible: this.pdfRespInput.value,
        notes: this.pdfNotesInput.value,
        orientation: this.pdfOrientationSelect.value,
        marginTop: parseInt(this.pdfMarginV.value) || 12,
        marginBottom: parseInt(this.pdfMarginV.value) || 12,
        marginLeft: parseInt(this.pdfMarginH.value) || 15,
        marginRight: parseInt(this.pdfMarginH.value) || 15,
        showStatsTable: this.pdfIncludeTable.checked,
        logoBase64: this.customLogoBase64 || null,
        filename: this.currentFilename
      };

      await this.pdfService.generatePDF(this.chartManager, this.currentDataset, options);
      this.closePDFDesigner();
      this.showToast('Relatório PDF baixado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      this.showToast(`Erro ao gerar PDF: ${err.message}`, 'error');
    }
  }

  // Toast
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : ''}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Tema Claro / Escuro
  initTheme() {
    const savedTheme = localStorage.getItem('koppert_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('koppert_theme', newTheme);
    this.updateThemeIcon(newTheme);

    if (this.chartManager) {
      this.chartManager.render();
    }
  }

  updateThemeIcon(theme) {
    if (this.themeIcon) {
      this.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }
}

// Inicializa a aplicação ao carregar o DOM
window.addEventListener('DOMContentLoaded', () => {
  window.koppertApp = new App();
});

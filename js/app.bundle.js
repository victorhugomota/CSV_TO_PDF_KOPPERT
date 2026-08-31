/**
 * Koppert Telemetria CSV to PDF - Bundle Universal
 * Layout Oficial Koppert Brasil, Ajuste de Gráfico Instantâneo e Salvamento Exclusivo sob Demanda
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // 1. SENSOR DATA PARSER
  // -------------------------------------------------------------
  class SensorDataParser {
    static SENSOR_TYPES = {
      TEMPERATURE: {
        type: 'temperature',
        group: 'Temperatura',
        unit: '°C'
      },
      HUMIDITY: {
        type: 'humidity',
        group: 'Umidade',
        unit: '%'
      },
      CO2: {
        type: 'co2',
        group: 'Dióxido de Carbono (CO2)',
        unit: 'PPM'
      },
      PRESSURE: {
        type: 'pressure',
        group: 'Pressão',
        unit: 'Pa'
      },
      OTHER: {
        type: 'other',
        group: 'Outros Sensores',
        unit: ''
      }
    };

    static identifySensorType(columnName) {
      const nameLower = (columnName || '').toLowerCase();
      if (nameLower.includes('temp') || nameLower.includes('temperatura')) {
        return this.SENSOR_TYPES.TEMPERATURE;
      }
      if (nameLower.includes('umid') || nameLower.includes('humid') || nameLower.includes('umidade')) {
        return this.SENSOR_TYPES.HUMIDITY;
      }
      if (nameLower.includes('co2') || nameLower.includes('carbon')) {
        return this.SENSOR_TYPES.CO2;
      }
      if (nameLower.includes('pressao') || nameLower.includes('press') || nameLower.includes('pressure')) {
        return this.SENSOR_TYPES.PRESSURE;
      }
      return this.SENSOR_TYPES.OTHER;
    }

    static normalizeValue(rawValue, sensorType) {
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        return null;
      }

      let strVal = String(rawValue).trim().replace(',', '.');
      strVal = strVal.replace(/^["']|["']$/g, '');

      if (strVal === '' || strVal === 'null' || strVal === 'NaN') {
        return null;
      }

      const num = parseFloat(strVal);
      if (isNaN(num)) return null;

      // Auto-ajuste de escala com 6 casas decimais implícitas (10⁶)
      // Ex: 21700000 -> 21.7 (°C), 71600000 -> 71.6 (%), 350000000 -> 350 (PPM)
      const abs = Math.abs(num);
      if (sensorType.type === 'temperature' && abs > 500) {
        return num / 1000000;
      }
      if (sensorType.type === 'humidity' && abs > 500) {
        return num / 1000000;
      }
      if (sensorType.type === 'co2' && abs > 20000) {
        return num / 1000000;
      }
      if (sensorType.type === 'pressure' && abs > 500000) {
        return num / 1000000;
      }
      if (sensorType.type === 'other' && abs > 1000000) {
        return num / 1000000;
      }

      return num;
    }

    static parseDateTime(dateStr) {
      if (!dateStr) return null;
      const clean = String(dateStr).trim().replace(/^["']|["']$/g, '');

      const timestamp = Date.parse(clean);
      if (!isNaN(timestamp)) {
        return timestamp;
      }

      const brRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
      const match = clean.match(brRegex);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const year = parseInt(match[3], 10);
        const hour = parseInt(match[4], 10);
        const min = parseInt(match[5], 10);
        const sec = match[6] ? parseInt(match[6], 10) : 0;
        return new Date(year, month, day, hour, min, sec).getTime();
      }

      return null;
    }

    static detectDelimiter(csvText) {
      const cleanText = (csvText || '').replace(/^\uFEFF/, '');
      const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || '';
      const commas = (firstLine.match(/,/g) || []).length;
      const semicolons = (firstLine.match(/;/g) || []).length;
      const tabs = (firstLine.match(/\t/g) || []).length;

      if (semicolons > commas && semicolons > tabs) return ';';
      if (tabs > commas && tabs > semicolons) return '\t';
      return ',';
    }

    static splitCSVLine(line, delimiter) {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    static generatePalette(count) {
      const curatedColors = [
        '#005a3c', '#24b35a', '#3b82f6', '#ef4444', '#f59e0b',
        '#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f97316',
        '#6366f1', '#14b8a6', '#e11d48', '#84cc16', '#a855f7',
        '#0284c7', '#d97706', '#059669', '#7c3aed', '#db2777',
        '#2563eb', '#65a30d', '#c026d3', '#0891b2', '#ea580c',
        '#4f46e5', '#16a34a', '#9333ea', '#eab308', '#0284c7'
      ];

      if (count <= curatedColors.length) {
        return curatedColors.slice(0, count);
      }

      const colors = [...curatedColors];
      for (let i = curatedColors.length; i < count; i++) {
        const hue = (i * 137.508) % 360;
        colors.push(`hsl(${hue.toFixed(1)}, 75%, 45%)`);
      }
      return colors;
    }

    static parse(csvText) {
      const cleanText = (csvText || '').replace(/^\uFEFF/, '');
      const delimiter = this.detectDelimiter(cleanText);

      const lines = cleanText.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('O arquivo CSV deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
      }

      const headers = this.splitCSVLine(lines[0], delimiter).map(h => h.replace(/^["']|["']$/g, ''));

      let timeColIndex = headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'time' || lower === 'data' || lower === 'date' || lower === 'timestamp' || lower === 'datetime' || lower === 'hora';
      });

      if (timeColIndex === -1) {
        timeColIndex = 0;
      }

      const sensors = [];
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        if (colIdx === timeColIndex) continue;
        const headerName = headers[colIdx];
        const lower = headerName.toLowerCase();

        if (lower === 'event' || lower === 'evento') continue;

        const sensorType = this.identifySensorType(headerName);
        sensors.push({
          id: `sensor_${colIdx}`,
          columnIndex: colIdx,
          name: headerName,
          type: sensorType.type,
          group: sensorType.group,
          unit: sensorType.unit,
          color: '#005a3c',
          enabled: true,
          data: []
        });
      }

      const colors = this.generatePalette(sensors.length);
      sensors.forEach((sensor, i) => {
        sensor.color = colors[i];
      });

      const timestamps = [];
      const events = [];
      const eventColIndex = headers.findIndex(h => h.toLowerCase() === 'event' || h.toLowerCase() === 'evento');

      for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
        const row = this.splitCSVLine(lines[lineIdx], delimiter);
        if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

        const rawTime = row[timeColIndex];
        const parsedTime = this.parseDateTime(rawTime);
        const timeVal = parsedTime !== null ? parsedTime : (lineIdx - 1);
        timestamps.push(timeVal);

        if (eventColIndex !== -1 && row[eventColIndex]) {
          const ev = row[eventColIndex].trim();
          if (ev) {
            events.push({ time: timeVal, event: ev });
          }
        }

        sensors.forEach(sensor => {
          const rawVal = row[sensor.columnIndex];
          const val = this.normalizeValue(rawVal, { type: sensor.type });
          sensor.data.push([timeVal, val]);
        });
      }

      sensors.forEach(sensor => {
        const validPoints = sensor.data.map(d => d[1]).filter(v => v !== null && !isNaN(v));
        if (validPoints.length > 0) {
          sensor.stats = {
            min: Math.min(...validPoints),
            max: Math.max(...validPoints),
            avg: validPoints.reduce((acc, v) => acc + v, 0) / validPoints.length,
            last: validPoints[validPoints.length - 1],
            count: validPoints.length
          };
        } else {
          sensor.stats = { min: 0, max: 0, avg: 0, last: 0, count: 0 };
        }
      });

      return {
        headers,
        timeColumn: headers[timeColIndex],
        timestamps,
        events,
        sensors,
        totalRows: timestamps.length,
        timeRange: {
          start: timestamps[0] || null,
          end: timestamps[timestamps.length - 1] || null
        }
      };
    }
  }

  // -------------------------------------------------------------
  // 2. SENSOR CHART MANAGER (ECharts com Auto-Resize Garantido)
  // -------------------------------------------------------------
  class SensorChartManager {
    constructor(containerElement) {
      this.container = containerElement;
      this.chart = null;
      this.dataset = null;
      this.initECharts();
    }

    initECharts() {
      if (typeof echarts === 'undefined') {
        console.error('Apache ECharts não disponível!');
        return;
      }
      this.chart = echarts.init(this.container, null, {
        renderer: 'canvas',
        useDirtyRect: true
      });

      // Observer de redimensionamento instantâneo
      if (window.ResizeObserver && this.container) {
        const ro = new ResizeObserver(() => {
          if (this.chart) {
            this.chart.resize();
          }
        });
        ro.observe(this.container);
      }

      window.addEventListener('resize', () => {
        if (this.chart) this.chart.resize();
      });
    }

    setDataset(parsedData) {
      this.dataset = parsedData;
      this.render();

      // Força redimensionamento imediato e em múltiplos frames para evitar gráfico contraído
      this.resize();
      requestAnimationFrame(() => this.resize());
      setTimeout(() => this.resize(), 50);
      setTimeout(() => this.resize(), 200);
    }

    resize() {
      if (this.chart) {
        this.chart.resize();
      }
    }

    formatDate(timestamp) {
      if (!timestamp) return '';
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return String(timestamp);

      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${hours}:${mins}`;
    }

    render() {
      if (!this.chart || !this.dataset) return;

      const isDark = document.body.getAttribute('data-theme') === 'dark';
      const textColor = isDark ? '#9cb5ab' : '#4a5e54';
      const gridLineColor = isDark ? '#1f362c' : '#e3ded6';

      const activeSensors = this.dataset.sensors.filter(s => s.enabled);

      const series = activeSensors.map(sensor => ({
        name: sensor.name,
        type: 'line',
        showSymbol: false,
        smooth: false,
        sampling: 'lttb',
        data: sensor.data,
        lineStyle: {
          width: 1.6,
          color: sensor.color
        },
        itemStyle: {
          color: sensor.color
        }
      }));

      const option = {
        animation: false,
        backgroundColor: 'transparent',
        grid: {
          top: 35,
          left: 60,
          right: 30,
          bottom: 80,
          containLabel: false
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            lineStyle: {
              color: '#004832',
              type: 'dashed'
            }
          },
          backgroundColor: isDark ? 'rgba(20, 34, 28, 0.96)' : 'rgba(255, 255, 255, 0.96)',
          borderColor: '#004832',
          borderWidth: 1.5,
          padding: [10, 14],
          textStyle: {
            color: isDark ? '#f0f7f4' : '#0f241a',
            fontSize: 12
          },
          formatter: (params) => {
            if (!params || !params.length) return '';
            const time = params[0].value[0];
            let header = `<div style="font-weight:800;margin-bottom:6px;border-bottom:1.5px solid #24b35a;padding-bottom:4px;color:#004832;">${this.formatDate(time)}</div>`;
            let rows = params.map(p => {
              const sensor = this.dataset.sensors.find(s => s.name === p.seriesName);
              const unit = sensor ? sensor.unit : '';
              const val = p.value[1] !== null && p.value[1] !== undefined ? Number(p.value[1].toFixed(2)) : 'N/A';
              return `<div style="display:flex;justify-content:space-between;gap:14px;margin:3px 0;">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px;"></span>${p.seriesName}:</span>
                <strong style="color:${p.color}">${val} ${unit}</strong>
              </div>`;
            }).join('');
            return header + rows;
          }
        },
        toolbox: {
          right: 30,
          top: 0,
          feature: {
            dataZoom: {
              yAxisIndex: 'none',
              title: { zoom: 'Zoom por Área', back: 'Restaurar Zoom' }
            },
            restore: { title: 'Resetar' },
            saveAsImage: {
              title: 'Salvar Imagem PNG',
              pixelRatio: 2.5
            }
          },
          iconStyle: {
            borderColor: textColor
          }
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLine: {
            lineStyle: { color: gridLineColor }
          },
          axisLabel: {
            color: textColor,
            fontSize: 11,
            formatter: (value) => {
              const d = new Date(value);
              const day = d.getDate();
              const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
              return `${day} ${months[d.getMonth()]}`;
            }
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: gridLineColor,
              type: 'solid'
            }
          }
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLine: {
            show: true,
            lineStyle: { color: gridLineColor }
          },
          axisLabel: {
            color: textColor,
            fontSize: 11,
            formatter: (val) => {
              if (val >= 1000) return (val / 1000) + 'K';
              if (val <= -1000) return (val / 1000) + 'K';
              return val;
            }
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: gridLineColor,
              type: 'solid'
            }
          }
        },
        dataZoom: [
          {
            type: 'slider',
            show: true,
            xAxisIndex: [0],
            bottom: 10,
            height: 38,
            borderColor: gridLineColor,
            backgroundColor: isDark ? '#14221c' : '#faf8f5',
            fillerColor: 'rgba(0, 72, 50, 0.2)',
            handleStyle: {
              color: '#004832',
              borderColor: '#ffffff',
              borderWidth: 1.5,
              shadowBlur: 3,
              shadowColor: 'rgba(0,0,0,0.2)'
            },
            textStyle: {
              color: textColor,
              fontSize: 10
            },
            brushSelect: true
          },
          {
            type: 'inside',
            xAxisIndex: [0]
          }
        ],
        series: series
      };

      this.chart.setOption(option, true);
    }

    toggleSensor(sensorId, enabled) {
      if (!this.dataset) return;
      const sensor = this.dataset.sensors.find(s => s.id === sensorId);
      if (sensor) {
        sensor.enabled = enabled;
        this.render();
      }
    }

    toggleAll(enabled) {
      if (!this.dataset) return;
      this.dataset.sensors.forEach(s => s.enabled = enabled);
      this.render();
    }

    getImageDataURL() {
      if (!this.chart) return null;
      return this.chart.getDataURL({
        type: 'png',
        pixelRatio: 2.5,
        backgroundColor: '#ffffff'
      });
    }
  }

  // -------------------------------------------------------------
  // 3. PDF EXPORT SERVICE (jsPDF)
  // -------------------------------------------------------------
  // Helper: hex color to RGB array
  function hexToRgb(hex) {
    hex = (hex || '#24b35a').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  class PDFExportService {
    constructor() {
      this.defaultLogo = null;
      this.createDefaultLogo();
    }

    createDefaultLogo() {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#004832';
      ctx.beginPath();
      ctx.roundRect(0, 0, 280, 80, 10);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KOPPERT', 140, 36);

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#24b35a';
      ctx.fillText('PARTNERS WITH NATURE', 140, 60);

      this.defaultLogo = canvas.toDataURL('image/png');
    }

    async generatePDF(chartManager, dataset, options = {}) {
      const jspdfModule = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
      if (!jspdfModule) throw new Error('Biblioteca jsPDF não carregada.');

      const orientation = options.orientation || 'landscape';
      const doc = new jspdfModule({ orientation, unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const mTop = options.marginTop  !== undefined ? Number(options.marginTop)  : 12;
      const mBot = options.marginBottom !== undefined ? Number(options.marginBottom) : 14;
      const mLeft = options.marginLeft !== undefined ? Number(options.marginLeft) : 15;
      const mRight = options.marginRight !== undefined ? Number(options.marginRight) : 15;
      const pw = pageW - mLeft - mRight; // printable width
      const HEADER_H = 24;
      const FOOTER_H = 8;
      const USABLE   = pageH - HEADER_H - mBot - FOOTER_H;

      // ── helpers ────────────────────────────────────────────────────────────
      const logoImg = options.logoBase64 || this.defaultLogo;

      const drawHeader = (pageNum, totalPages) => {
        // Barra verde topo
        doc.setFillColor(0, 72, 50);
        doc.rect(0, 0, pageW, 7, 'F');

        // Logo
        if (logoImg) {
          try { doc.addImage(logoImg, 'PNG', mLeft, 9, 36, 12); } catch (e) {}
        }

        // Títulos
        const title    = (options.title    || 'RELATÓRIO DE MONITORAMENTO E TELEMETRIA').toUpperCase();
        const subtitle = options.subtitle  || 'Koppert Brasil — Proteção Biológica das Culturas';
        const txX = mLeft + 36 + 8;

        doc.setFont('helvetica', 'bold');   doc.setFontSize(11);
        doc.setTextColor(0, 72, 50);        doc.text(title, txX, 14);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.setTextColor(80, 100, 90);      doc.text(subtitle, txX, 19.5);

        // Data / arquivo (direita)
        const now = new Date();
        const dateFmt = [
          String(now.getDate()).padStart(2,'0'),
          String(now.getMonth()+1).padStart(2,'0'),
          now.getFullYear()
        ].join('/') + ' ' + [
          String(now.getHours()).padStart(2,'0'),
          String(now.getMinutes()).padStart(2,'0')
        ].join(':');

        doc.setFontSize(7); doc.setTextColor(120, 130, 125);
        doc.text(`Emissão: ${dateFmt}`, pageW - mRight, 12, { align: 'right' });
        if (options.filename)
          doc.text(`Arquivo: ${options.filename}`, pageW - mRight, 17, { align: 'right' });

        // Linha separadora
        doc.setDrawColor(0, 72, 50); doc.setLineWidth(0.45);
        doc.line(mLeft, HEADER_H, pageW - mRight, HEADER_H);

        // Número de página (pequeno, acima da linha)
        doc.setFontSize(6.5); doc.setTextColor(140, 155, 148);
        doc.text(`Página ${pageNum} / ${totalPages}`, pageW - mRight, HEADER_H - 1, { align: 'right' });
      };

      const drawFooter = () => {
        const fy = pageH - mBot + 3;
        doc.setDrawColor(200, 215, 205); doc.setLineWidth(0.2);
        doc.line(mLeft, fy - 2, pageW - mRight, fy - 2);
        doc.setFontSize(6.5); doc.setTextColor(160, 170, 165);
        doc.text('Koppert Brasil • Parceiros com a Natureza • Sistema de Telemetria CSV to PDF', mLeft, fy + 1);
        if (options.responsible)
          doc.text(`Responsável: ${options.responsible}`, pageW - mRight, fy + 1, { align: 'right' });
      };

      // ── calcular número total de páginas ───────────────────────────────────
      const showStats = options.showStatsTable !== false && dataset && dataset.sensors;
      const activeSensors = showStats ? dataset.sensors.filter(s => s.enabled) : [];

      const ROW_H        = 5.2;
      const TBL_HDR_H    = 8;
      const TBL_TITLE_H  = 8;
      const INFO_BOX_H   = (options.responsible || options.notes) ? 12 : 0;
      const rowsPerPage  = Math.floor((USABLE - TBL_TITLE_H - TBL_HDR_H) / ROW_H);
      const tablePages   = activeSensors.length > 0 ? Math.ceil(activeSensors.length / rowsPerPage) : 0;
      const totalPages   = 1 + tablePages;

      // ── PÁGINA 1: Gráfico ──────────────────────────────────────────────────
      drawHeader(1, totalPages);
      let y = HEADER_H + 3;

      // Info box
      if (options.responsible || options.notes) {
        doc.setFillColor(244, 248, 246);
        doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.25);
        doc.roundedRect(mLeft, y, pw, 9, 1.5, 1.5, 'FD');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        let info = '';
        if (options.responsible) info += `Responsável Técnico: ${options.responsible}   `;
        if (options.notes)       info += `Observações: ${options.notes}`;
        doc.text(info, mLeft + 3, y + 6);
        y += 12;
      }

      // Rótulo da seção de gráfico
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.setTextColor(0, 72, 50);
      doc.text('Gráfico de Telemetria dos Sensores', mLeft, y + 5);
      y += 7;

      // Gráfico
      const chartImgData = chartManager.getImageDataURL();
      if (chartImgData) {
        const chartH = pageH - y - mBot - FOOTER_H - 2;
        doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.3);
        doc.rect(mLeft, y, pw, chartH);
        doc.addImage(chartImgData, 'PNG', mLeft + 1, y + 1, pw - 2, chartH - 2);
      } else {
        doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text('[Gráfico não disponível]', mLeft + pw / 2, y + 30, { align: 'center' });
      }

      drawFooter();

      // ── PÁGINAS DA TABELA ─────────────────────────────────────────────────
      if (activeSensors.length > 0) {
        const cols = [
          { label: 'Sensor',          pct: 0.28 },
          { label: 'Tipo',            pct: 0.16 },
          { label: 'Unidade',         pct: 0.09 },
          { label: 'Mínimo',          pct: 0.11 },
          { label: 'Máximo',          pct: 0.11 },
          { label: 'Média',           pct: 0.11 },
          { label: 'Última Leitura',  pct: 0.14 },
        ].map(c => ({ ...c, w: pw * c.pct }));

        let sIdx = 0, tPage = 0;

        while (sIdx < activeSensors.length) {
          tPage++;
          doc.addPage();
          drawHeader(1 + tPage, totalPages);
          y = HEADER_H + 3;

          // Título
          const tblLabel = tablePages > 1
            ? `Resumo Estatístico dos Sensores (${tPage} / ${tablePages})`
            : 'Resumo Estatístico dos Sensores Monitorados';
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
          doc.setTextColor(0, 72, 50);
          doc.text(tblLabel, mLeft, y + 5);
          y += TBL_TITLE_H;

          // Cabeçalho da tabela (fundo verde escuro)
          doc.setFillColor(0, 72, 50);
          doc.rect(mLeft, y, pw, TBL_HDR_H - 1, 'F');

          let cx = mLeft;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          cols.forEach(col => {
            doc.text(col.label, cx + 2.5, y + 5.5);
            cx += col.w;
          });
          y += TBL_HDR_H - 1;

          // Linhas
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
          const rowsThis = Math.min(rowsPerPage, activeSensors.length - sIdx);

          for (let r = 0; r < rowsThis; r++) {
            const sensor = activeSensors[sIdx + r];
            const stats  = sensor.stats || { min: 0, max: 0, avg: 0, last: 0 };

            // Zebra
            if (r % 2 === 0) {
              doc.setFillColor(244, 248, 246);
              doc.rect(mLeft, y, pw, ROW_H, 'F');
            }

            // Bolinha colorida do sensor
            const rgb = hexToRgb(sensor.color || '#24b35a');
            doc.setFillColor(rgb[0], rgb[1], rgb[2]);
            doc.circle(mLeft + 3, y + ROW_H / 2, 1.3, 'F');

            doc.setTextColor(30, 41, 59);
            cx = mLeft;

            const sName = sensor.name.length > 40 ? sensor.name.substring(0, 38) + '…' : sensor.name;
            const lastVal = stats.last !== undefined ? Number(stats.last).toFixed(2) : '-';
            const rowData = [
              sName,
              sensor.group || '-',
              sensor.unit  || '-',
              Number(stats.min).toFixed(2),
              Number(stats.max).toFixed(2),
              Number(stats.avg).toFixed(2),
              lastVal,
            ];

            rowData.forEach((val, ci) => {
              doc.text(String(val), cx + (ci === 0 ? 6 : 2.5), y + 3.6);
              cx += cols[ci].w;
            });

            // Linha divisória leve
            doc.setDrawColor(220, 232, 226); doc.setLineWidth(0.15);
            doc.line(mLeft, y + ROW_H, mLeft + pw, y + ROW_H);

            y += ROW_H;
          }

          // Borda externa da tabela
          const tblTotalH = (TBL_HDR_H - 1) + rowsThis * ROW_H;
          doc.setDrawColor(120, 170, 148); doc.setLineWidth(0.35);
          doc.rect(mLeft, HEADER_H + 3 + TBL_TITLE_H, pw, tblTotalH);

          sIdx += rowsThis;
          drawFooter();
        }
      }

      // ── Salvar ─────────────────────────────────────────────────────────────
      const saveName = options.filename
        ? `Relatorio_Koppert_${options.filename.replace(/\.csv$/i, '')}.pdf`
        : `Relatorio_Koppert_${Date.now()}.pdf`;
      doc.save(saveName);
    }
  }

  // -------------------------------------------------------------
  // 4. FIREBASE & CLOUD HISTORY (Apenas sob demanda do usuário)
  // -------------------------------------------------------------
  class FirebaseHistoryService {
    constructor() {
      this.collectionName = "graficos_historico";
    }

    async saveChartHistory(record) {
      const dataToSave = {
        filename: record.filename || 'dados_telemetria.csv',
        createdAt: new Date().toISOString(),
        totalRows: record.totalRows || 0,
        sensorCount: record.sensors ? record.sensors.length : 0,
        sensorsSummary: (record.sensors || []).map(s => ({
          name: s.name,
          type: s.type,
          unit: s.unit,
          stats: s.stats || null
        })),
        csvData: record.csvRaw ? record.csvRaw.substring(0, 500000) : ''
      };

      this.saveToLocalCache(dataToSave);
      return { success: true, id: 'local_' + Date.now(), source: 'local' };
    }

    async loadHistory() {
      const localItems = this.loadFromLocalCache();
      return localItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async deleteItem(id) {
      this.deleteFromLocalCache(id);
      return true;
    }

    saveToLocalCache(record) {
      try {
        const existing = this.loadFromLocalCache();
        const newRecord = { ...record, id: 'local_' + Date.now() };
        existing.unshift(newRecord);
        localStorage.setItem('koppert_charts_history', JSON.stringify(existing.slice(0, 30)));
      } catch (e) {
        console.warn('Erro localStorage:', e);
      }
    }

    loadFromLocalCache() {
      try {
        const data = localStorage.getItem('koppert_charts_history');
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    }

    deleteFromLocalCache(id) {
      try {
        let existing = this.loadFromLocalCache();
        existing = existing.filter(item => item.id !== id);
        localStorage.setItem('koppert_charts_history', JSON.stringify(existing));
      } catch (e) {
        console.warn('Erro ao deletar do localStorage:', e);
      }
    }
  }

  // -------------------------------------------------------------
  // 5. APLICAÇÃO PRINCIPAL
  // -------------------------------------------------------------
  class KoppertApp {
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
      this.dropzone = document.getElementById('dropzone');
      this.fileInput = document.getElementById('file-input');
      this.btnBrowse = document.getElementById('btn-browse-file');

      this.fileInfoBar = document.getElementById('file-info-bar');
      this.infoFilename = document.getElementById('info-filename');
      this.infoRows = document.getElementById('info-rows');
      this.infoSensorCount = document.getElementById('info-sensor-count');
      this.infoTimeRange = document.getElementById('info-time-range');

      this.sensorsSection = document.getElementById('sensors-section');
      this.sensorCategories = document.getElementById('sensor-categories');
      this.btnSelectAll = document.getElementById('btn-select-all');
      this.btnSelectNone = document.getElementById('btn-select-none');
      this.btnFilterTemp = document.getElementById('btn-filter-temp');
      this.btnFilterUmid = document.getElementById('btn-filter-umid');
      this.btnFilterCo2 = document.getElementById('btn-filter-co2');
      this.btnFilterPress = document.getElementById('btn-filter-press');

      this.chartSection = document.getElementById('chart-section');
      this.chartTitle = document.getElementById('chart-main-title');
      this.chartSubtitle = document.getElementById('chart-main-subtitle');
      this.statsTableBody = document.getElementById('stats-table-body');
      this.btnSaveCloud = document.getElementById('btn-save-cloud');
      this.btnOpenPdfDesigner = document.getElementById('btn-open-pdf-designer');

      this.pdfModal = document.getElementById('pdf-modal');
      this.btnClosePdfModal = document.getElementById('btn-close-pdf-modal');
      this.btnCancelPdf = document.getElementById('btn-cancel-pdf');
      this.btnDownloadPdfNow = document.getElementById('btn-download-pdf-now');
      this.btnUploadLogo = document.getElementById('btn-upload-logo');
      this.btnResetLogo = document.getElementById('btn-reset-logo');
      this.pdfLogoInput = document.getElementById('pdf-logo-input');

      this.pdfTitleInput = document.getElementById('pdf-title-input');
      this.pdfSubtitleInput = document.getElementById('pdf-subtitle-input');
      this.pdfRespInput = document.getElementById('pdf-resp-input');
      this.pdfNotesInput = document.getElementById('pdf-notes-input');
      this.pdfOrientationSelect = document.getElementById('pdf-orientation-select');
      this.pdfMarginV = document.getElementById('pdf-margin-v');
      this.pdfMarginH = document.getElementById('pdf-margin-h');
      this.pdfIncludeTable = document.getElementById('pdf-include-table');

      this.pageMockup = document.getElementById('page-mockup');
      this.mockupGuide = document.getElementById('mockup-guide');
      this.mockupLogoImg = document.getElementById('mockup-logo-img');
      this.mockupTitleText = document.getElementById('mockup-title-text');
      this.mockupSubtitleText = document.getElementById('mockup-subtitle-text');
      this.mockupStatsArea = document.getElementById('mockup-stats-area');
      this.previewDimLabel = document.getElementById('preview-dim-label');

      this.historyModal = document.getElementById('history-modal');
      this.btnOpenHistory = document.getElementById('btn-open-history');
      this.btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
      this.btnCloseHistory = document.getElementById('btn-close-history');
      this.historyList = document.getElementById('history-list');

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
      if (this.btnBrowse) {
        this.btnBrowse.addEventListener('click', (e) => {
          e.stopPropagation();
          this.fileInput.click();
        });
      }

      if (this.dropzone) {
        this.dropzone.addEventListener('click', () => {
          this.fileInput.click();
        });

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
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            this.processFile(e.dataTransfer.files[0]);
          }
        });
      }

      if (this.fileInput) {
        this.fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length) {
            this.processFile(e.target.files[0]);
          }
        });
      }

      // Filtros
      if (this.btnSelectAll) {
        this.btnSelectAll.addEventListener('click', () => {
          if (!this.currentDataset) return;
          this.chartManager.toggleAll(true);
          this.updateSensorChipsState();
          this.updateStatsTable();
        });
      }

      if (this.btnSelectNone) {
        this.btnSelectNone.addEventListener('click', () => {
          if (!this.currentDataset) return;
          this.chartManager.toggleAll(false);
          this.updateSensorChipsState();
          this.updateStatsTable();
        });
      }

      if (this.btnFilterTemp) this.btnFilterTemp.addEventListener('click', () => this.filterByType('temperature'));
      if (this.btnFilterUmid) this.btnFilterUmid.addEventListener('click', () => this.filterByType('humidity'));
      if (this.btnFilterCo2) this.btnFilterCo2.addEventListener('click', () => this.filterByType('co2'));
      if (this.btnFilterPress) this.btnFilterPress.addEventListener('click', () => this.filterByType('pressure'));

      // Salvar na Nuvem (Apenas quando clicado)
      if (this.btnSaveCloud) {
        this.btnSaveCloud.addEventListener('click', () => this.saveCurrentToCloud());
      }

      // PDF Modal
      if (this.btnOpenPdfDesigner) this.btnOpenPdfDesigner.addEventListener('click', () => this.openPDFDesigner());
      if (this.btnClosePdfModal) this.btnClosePdfModal.addEventListener('click', () => this.closePDFDesigner());
      if (this.btnCancelPdf) this.btnCancelPdf.addEventListener('click', () => this.closePDFDesigner());
      if (this.btnDownloadPdfNow) this.btnDownloadPdfNow.addEventListener('click', () => this.downloadPDF());

      if (this.btnUploadLogo) {
        this.btnUploadLogo.addEventListener('click', () => this.pdfLogoInput.click());
      }
      if (this.pdfLogoInput) {
        this.pdfLogoInput.addEventListener('change', (e) => this.handleCustomLogo(e));
      }
      if (this.btnResetLogo) {
        this.btnResetLogo.addEventListener('click', () => this.resetDefaultLogo());
      }

      if (this.pdfTitleInput) this.pdfTitleInput.addEventListener('input', () => this.updatePDFMockup());
      if (this.pdfSubtitleInput) this.pdfSubtitleInput.addEventListener('input', () => this.updatePDFMockup());
      if (this.pdfOrientationSelect) this.pdfOrientationSelect.addEventListener('change', () => this.updatePDFMockup());
      if (this.pdfMarginV) this.pdfMarginV.addEventListener('input', () => this.updatePDFMockup());
      if (this.pdfMarginH) this.pdfMarginH.addEventListener('input', () => this.updatePDFMockup());
      if (this.pdfIncludeTable) this.pdfIncludeTable.addEventListener('change', () => this.updatePDFMockup());

      // Histórico
      if (this.btnOpenHistory) this.btnOpenHistory.addEventListener('click', () => this.openHistoryModal());
      if (this.btnCloseHistoryModal) this.btnCloseHistoryModal.addEventListener('click', () => this.closeHistoryModal());
      if (this.btnCloseHistory) this.btnCloseHistory.addEventListener('click', () => this.closeHistoryModal());

      // Tema
      if (this.btnToggleTheme) this.btnToggleTheme.addEventListener('click', () => this.toggleTheme());
    }

    processFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        this.currentRawCSV = text;
        this.currentFilename = file.name;
        this.parseAndRender(text, file.name);
        this.showToast(`Arquivo "${file.name}" processado com sucesso!`, 'success');
      };
      reader.readAsText(file);
    }

    parseAndRender(csvText, filename) {
      try {
        const dataset = SensorDataParser.parse(csvText);
        this.currentDataset = dataset;

        if (this.fileInfoBar) this.fileInfoBar.style.display = 'flex';
        if (this.infoFilename) this.infoFilename.textContent = filename || 'dados.csv';
        if (this.infoRows) this.infoRows.textContent = dataset.totalRows.toLocaleString('pt-BR');
        if (this.infoSensorCount) this.infoSensorCount.textContent = `${dataset.sensors.length} sensores`;

        if (this.infoTimeRange) {
          if (dataset.timeRange.start && dataset.timeRange.end) {
            const d1 = new Date(dataset.timeRange.start);
            const d2 = new Date(dataset.timeRange.end);
            this.infoTimeRange.textContent = `${d1.toLocaleDateString('pt-BR')} ${d1.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até ${d2.toLocaleDateString('pt-BR')} ${d2.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
          } else {
            this.infoTimeRange.textContent = 'Sequencial';
          }
        }

        this.renderSensorCategories(dataset.sensors);
        if (this.sensorsSection) this.sensorsSection.style.display = 'block';

        if (this.chartSection) this.chartSection.style.display = 'block';
        if (this.chartTitle) this.chartTitle.textContent = `Telemetria: ${filename || 'Relatório de Sensores'}`;
        if (this.chartSubtitle) this.chartSubtitle.textContent = `Total de ${dataset.sensors.length} sensores monitorados com ajuste de grandezas (°C, %, PPM, Pa)`;

        this.chartManager.setDataset(dataset);
        this.updateStatsTable();

        // ATENÇÃO: NÃO salva automaticamente na nuvem. Salva apenas se o usuário clicar no botão!

      } catch (err) {
        console.error('Erro ao processar CSV:', err);
        this.showToast(`Erro ao processar CSV: ${err.message}`, 'error');
      }
    }

    renderSensorCategories(sensors) {
      if (!this.sensorCategories) return;
      this.sensorCategories.innerHTML = '';

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
          <div class="sensor-chips"></div>
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

    updateStatsTable() {
      if (!this.currentDataset || !this.statsTableBody) return;
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
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:12px; height:12px; border-radius:3px; background:${sensor.color}; display:inline-block;"></span>
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
        this.showToast('Gráfico salvo na nuvem com sucesso!', 'success');
      }
    }

    async openHistoryModal() {
      if (!this.historyModal) return;
      this.historyModal.classList.add('open');
      this.historyList.innerHTML = `<div class="empty-state">Carregando histórico do Firebase...</div>`;

      const items = await this.firebaseService.loadHistory();
      if (!items || items.length === 0) {
        this.historyList.innerHTML = `<div class="empty-state">Nenhum gráfico salvo no histórico ainda. Importe um arquivo CSV e clique em "Salvar na Nuvem"!</div>`;
        return;
      }

      this.historyList.innerHTML = '';
      items.forEach(item => {
        const date = new Date(item.createdAt);
        const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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
            this.showToast('Os dados brutos deste registro não estão disponíveis.', 'warning');
          }
        });

        div.querySelector('.btn-del-hist').addEventListener('click', async () => {
          await this.firebaseService.deleteItem(item.id);
          div.remove();
          this.showToast('Item excluído do histórico.', 'info');
        });

        this.historyList.appendChild(div);
      });
    }

    closeHistoryModal() {
      if (this.historyModal) this.historyModal.classList.remove('open');
    }

    openPDFDesigner() {
      if (this.mockupLogoImg) {
        this.mockupLogoImg.src = this.customLogoBase64 || this.pdfService.defaultLogo;
      }
      this.updatePDFMockup();
      if (this.pdfModal) this.pdfModal.classList.add('open');
    }

    closePDFDesigner() {
      if (this.pdfModal) this.pdfModal.classList.remove('open');
    }

    handleCustomLogo(e) {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.customLogoBase64 = ev.target.result;
          if (this.mockupLogoImg) this.mockupLogoImg.src = this.customLogoBase64;
          this.showToast('Foto do cabeçalho atualizada!', 'success');
        };
        reader.readAsDataURL(file);
      }
    }

    resetDefaultLogo() {
      this.customLogoBase64 = null;
      if (this.mockupLogoImg) this.mockupLogoImg.src = this.pdfService.defaultLogo;
      this.showToast('Logo padrão Koppert restaurado.', 'info');
    }

    updatePDFMockup() {
      const container = document.querySelector('.page-mockup-wrapper');
      if (!container) return;

      const orientation = this.pdfOrientationSelect ? this.pdfOrientationSelect.value : 'landscape';
      const title    = (this.pdfTitleInput    && this.pdfTitleInput.value)    || 'RELATÓRIO DE TELEMETRIA';
      const subtitle = (this.pdfSubtitleInput && this.pdfSubtitleInput.value) || 'Koppert Brasil';
      const marginV  = Math.max(5, Math.min(30, parseInt(this.pdfMarginV ? this.pdfMarginV.value : 12) || 12));
      const marginH  = Math.max(5, Math.min(30, parseInt(this.pdfMarginH ? this.pdfMarginH.value : 15) || 15));
      const showTable = this.pdfIncludeTable ? this.pdfIncludeTable.checked : true;

      if (this.previewDimLabel) {
        this.previewDimLabel.textContent = orientation === 'portrait'
          ? 'Retrato (210 × 297 mm)' : 'Paisagem (297 × 210 mm)';
      }

      // Contar páginas estimadas
      const activeSensors = (this.currentDataset && this.currentDataset.sensors)
        ? this.currentDataset.sensors.filter(s => s.enabled) : [];
      const rowsPerPage = 28;
      const tablePages  = (showTable && activeSensors.length > 0)
        ? Math.ceil(activeSensors.length / rowsPerPage) : 0;
      const totalPages  = 1 + tablePages;

      // Aspect ratio
      const isPortrait = orientation === 'portrait';
      const pw = isPortrait ? 210 : 297;
      const ph = isPortrait ? 297 : 210;
      // Scale para caber em ~360px de largura
      const scale = 360 / pw;
      const mockH = Math.round(ph * scale);

      const logoSrc = this.customLogoBase64 || this.pdfService.defaultLogo || '';
      const chartImg = this.chartManager ? this.chartManager.getImageDataURL() : null;

      // Build page 1 preview (chart page)
      const buildPage = (pageNum, isChartPage) => {
        const barH   = Math.round(7 * scale);
        const hdrH   = Math.round(24 * scale);
        const mT     = Math.round(marginV * scale);
        const mB     = Math.round(marginV * scale);
        const mL     = Math.round(marginH * scale);
        const mR     = Math.round(marginH * scale);
        const ftrH   = Math.round(8 * scale);
        const innerW = Math.round(pw * scale) - mL - mR;
        const innerH = Math.round(ph * scale) - hdrH - mB - ftrH;

        return `
          <div class="preview-page" style="
            width:${Math.round(pw * scale)}px;
            height:${mockH}px;
            background:#fff;
            border:1px solid #c8d8cf;
            border-radius:3px;
            position:relative;
            overflow:hidden;
            font-family:sans-serif;
            box-shadow:0 2px 8px rgba(0,0,0,.12);
            flex-shrink:0;
          ">
            <!-- barra verde topo -->
            <div style="background:#004832;height:${barH}px;width:100%;"></div>

            <!-- cabeçalho -->
            <div style="
              display:flex;align-items:center;
              padding:${Math.round(2*scale)}px ${mL}px;
              height:${hdrH - barH}px;
              border-bottom:1.5px solid #004832;
            ">
              ${logoSrc ? `<img src="${logoSrc}" style="height:${Math.round(12*scale)}px;max-width:${Math.round(40*scale)}px;object-fit:contain;" alt="Logo">` : ''}
              <div style="margin-left:${Math.round(6*scale)}px;flex:1;overflow:hidden;">
                <div style="font-weight:800;font-size:${Math.round(9*scale)}px;color:#004832;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
                <div style="font-size:${Math.round(6.5*scale)}px;color:#4a7a62;margin-top:${Math.round(1*scale)}px;">${subtitle}</div>
              </div>
              <div style="text-align:right;font-size:${Math.round(5.5*scale)}px;color:#999;">
                Pág. ${pageNum}/${totalPages}
              </div>
            </div>

            <!-- área de conteúdo -->
            <div style="
              position:absolute;
              left:${mL}px;top:${hdrH}px;
              width:${innerW}px;height:${innerH}px;
              display:flex;flex-direction:column;gap:${Math.round(3*scale)}px;
              padding-top:${Math.round(3*scale)}px;
            ">
              ${isChartPage ? `
                <div style="font-size:${Math.round(6*scale)}px;font-weight:700;color:#004832;">
                  Gráfico de Telemetria dos Sensores
                </div>
                <div style="
                  flex:1;border:1px solid #b8d4c4;border-radius:2px;overflow:hidden;
                  background:#f7faf8;display:flex;align-items:center;justify-content:center;
                ">
                  ${chartImg
                    ? `<img src="${chartImg}" style="width:100%;height:100%;object-fit:contain;" alt="Gráfico">`
                    : `<span style="font-size:${Math.round(6*scale)}px;color:#aaa;">GRÁFICO DE TELEMETRIA</span>`
                  }
                </div>
              ` : `
                <div style="font-size:${Math.round(6*scale)}px;font-weight:700;color:#004832;">
                  Resumo Estatístico dos Sensores Monitorados
                </div>
                <!-- Cabeçalho tabela -->
                <div style="background:#004832;display:grid;grid-template-columns:3fr 2fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr;
                  padding:${Math.round(2*scale)}px ${Math.round(2*scale)}px;border-radius:2px 2px 0 0;">
                  ${['Sensor','Tipo','Un.','Mín','Máx','Média','Última'].map(c =>
                    `<span style="font-size:${Math.round(5*scale)}px;color:#fff;font-weight:700;">${c}</span>`
                  ).join('')}
                </div>
                <!-- Linhas da tabela -->
                ${activeSensors.slice(0, Math.floor(innerH / Math.round(ROW_H_PX = 5.2 * scale))).map((s, i) => `
                  <div style="display:grid;grid-template-columns:3fr 2fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr;
                    padding:${Math.round(1.5*scale)}px ${Math.round(2*scale)}px;
                    background:${i%2===0?'#f0f7f3':'#fff'};align-items:center;">
                    <span style="font-size:${Math.round(4.8*scale)}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;align-items:center;gap:${Math.round(2*scale)}px;">
                      <span style="width:${Math.round(4*scale)}px;height:${Math.round(4*scale)}px;border-radius:50%;background:${s.color||'#24b35a'};flex-shrink:0;"></span>
                      ${s.name}
                    </span>
                    ${[s.group||'-', s.unit||'-',
                       (s.stats&&s.stats.min!==undefined?Number(s.stats.min).toFixed(1):'-'),
                       (s.stats&&s.stats.max!==undefined?Number(s.stats.max).toFixed(1):'-'),
                       (s.stats&&s.stats.avg!==undefined?Number(s.stats.avg).toFixed(1):'-'),
                       (s.stats&&s.stats.last!==undefined?Number(s.stats.last).toFixed(1):'-')
                      ].map(v => `<span style="font-size:${Math.round(4.8*scale)}px;">${v}</span>`).join('')}
                  </div>
                `).join('')}
              `}
            </div>

            <!-- rodapé -->
            <div style="
              position:absolute;bottom:0;left:0;right:0;
              height:${ftrH}px;
              border-top:1px solid #d0e5da;
              display:flex;align-items:center;justify-content:space-between;
              padding:0 ${mL}px;
              background:#fff;
            ">
              <span style="font-size:${Math.round(4.5*scale)}px;color:#aaa;">Koppert Brasil • Parceiros com a Natureza</span>
              <span style="font-size:${Math.round(4.5*scale)}px;color:#aaa;">Pág ${pageNum}/${totalPages}</span>
            </div>
          </div>
        `;
      };

      // Montar todas as páginas
      let pagesHtml = buildPage(1, true);
      for (let p = 2; p <= totalPages; p++) {
        pagesHtml += buildPage(p, false);
      }

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;align-items:center;padding:8px 0;
          max-height:520px;overflow-y:auto;">
          ${pagesHtml}
        </div>
      `;

      // Manter referência ao pageMockup para compatibilidade (aponta para o primeiro .preview-page)
      this.pageMockup = container.querySelector('.preview-page');
    }

    async downloadPDF() {
      try {
        this.showToast('Gerando relatório corporativo em PDF...', 'info');

        const options = {
          title: this.pdfTitleInput ? this.pdfTitleInput.value : '',
          subtitle: this.pdfSubtitleInput ? this.pdfSubtitleInput.value : '',
          responsible: this.pdfRespInput ? this.pdfRespInput.value : '',
          notes: this.pdfNotesInput ? this.pdfNotesInput.value : '',
          orientation: this.pdfOrientationSelect ? this.pdfOrientationSelect.value : 'landscape',
          marginTop: parseInt(this.pdfMarginV ? this.pdfMarginV.value : 12) || 12,
          marginBottom: parseInt(this.pdfMarginV ? this.pdfMarginV.value : 12) || 12,
          marginLeft: parseInt(this.pdfMarginH ? this.pdfMarginH.value : 15) || 15,
          marginRight: parseInt(this.pdfMarginH ? this.pdfMarginH.value : 15) || 15,
          showStatsTable: this.pdfIncludeTable ? this.pdfIncludeTable.checked : true,
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.koppertApp = new KoppertApp();
    });
  } else {
    window.koppertApp = new KoppertApp();
  }

})();

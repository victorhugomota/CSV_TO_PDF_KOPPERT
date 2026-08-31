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
  // Logo Oficial Koppert Padrao (extraida da identidade visual enviada)
  const KOPPERT_OFFICIAL_LOGO = "data:image/png;base64,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";

  // Helper: hex color to RGB array
  function hexToRgb(hex) {
    hex = (hex || '#24b35a').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return [36, 179, 90];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  class PDFExportService {
    constructor() {
      this.defaultLogo = KOPPERT_OFFICIAL_LOGO;
    }

    async generatePDF(chartManager, dataset, options = {}) {
      const jspdfModule = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
      if (!jspdfModule) throw new Error('Biblioteca jsPDF não carregada.');

      const orientation = options.orientation || 'landscape';
      const doc = new jspdfModule({ orientation, unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const mTop = options.marginTop !== undefined ? Number(options.marginTop) : 12;
      const mBot = options.marginBottom !== undefined ? Number(options.marginBottom) : 12;
      const mLeft = options.marginLeft !== undefined ? Number(options.marginLeft) : 15;
      const mRight = options.marginRight !== undefined ? Number(options.marginRight) : 15;
      const pw = pageW - mLeft - mRight; // Printable width

      const HEADER_H = 22;
      const FOOTER_RESERVED = 12;

      // Sensores ativos para a tabela
      const showStats = options.showStatsTable !== false && dataset && dataset.sensors;
      const activeSensors = showStats ? dataset.sensors.filter(s => s.enabled) : [];

      // Alturas da tabela
      const ROW_H = 5.5;
      const TBL_HDR_H = 7.5;
      const TBL_TITLE_H = 8;

      // Espaço útil para linhas na página de tabela
      const tableUsableH = pageH - HEADER_H - mBot - FOOTER_RESERVED - TBL_TITLE_H - TBL_HDR_H - 2;
      const rowsPerPage = Math.max(1, Math.floor(tableUsableH / ROW_H));
      const tablePagesCount = (showStats && activeSensors.length > 0) ? Math.ceil(activeSensors.length / rowsPerPage) : 0;

      // Página 1 SEMPRE é o gráfico. Páginas 2+ são a tabela.
      const totalPages = 1 + tablePagesCount;

      // Função Cabeçalho Institucional
      const drawHeader = (pageNum) => {
        // Barra verde Koppert no topo
        doc.setFillColor(0, 72, 50);
        doc.rect(0, 0, pageW, 5, 'F');

        // Logo Koppert Oficial
        const logoImg = this.defaultLogo;
        const logoW = 34;
        const logoH = 11;
        if (logoImg) {
          try {
            doc.addImage(logoImg, 'PNG', mLeft, 8, logoW, logoH, undefined, 'FAST');
          } catch (e) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(0, 72, 50);
            doc.text('KOPPERT', mLeft, 16);
          }
        }

        // Textos do cabeçalho
        const title = (options.title || 'RELATÓRIO DE MONITORAMENTO E TELEMETRIA').toUpperCase();
        const subtitle = options.subtitle || 'Koppert Brasil — Proteção Biológica das Culturas';
        const txX = mLeft + logoW + 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(0, 72, 50);
        doc.text(title, txX, 12.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(74, 94, 84);
        doc.text(subtitle, txX, 17.5);

        // Data de emissão e nome do arquivo à direita
        const now = new Date();
        const dateFmt = [
          String(now.getDate()).padStart(2, '0'),
          String(now.getMonth() + 1).padStart(2, '0'),
          now.getFullYear()
        ].join('/') + ' ' + [
          String(now.getHours()).padStart(2, '0'),
          String(now.getMinutes()).padStart(2, '0')
        ].join(':');

        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 110);
        doc.text(`Emissão: ${dateFmt}`, pageW - mRight, 11.5, { align: 'right' });
        if (options.filename) {
          doc.text(`Arquivo: ${options.filename}`, pageW - mRight, 16, { align: 'right' });
        }

        // Linha divisória elegante
        doc.setDrawColor(0, 72, 50);
        doc.setLineWidth(0.4);
        doc.line(mLeft, HEADER_H, pageW - mRight, HEADER_H);

        // Número da página no canto superior direito
        doc.setFontSize(6.5);
        doc.setTextColor(140, 155, 148);
        doc.text(`Página ${pageNum} de ${totalPages}`, pageW - mRight, HEADER_H - 1, { align: 'right' });
      };

      // Função Rodapé Institucional
      const drawFooter = (pageNum) => {
        const fy = pageH - mBot;
        doc.setDrawColor(200, 215, 205);
        doc.setLineWidth(0.2);
        doc.line(mLeft, fy - 3, pageW - mRight, fy - 3);

        doc.setFontSize(6.5);
        doc.setTextColor(120, 135, 128);
        doc.text('Koppert Brasil • Parceiros com a Natureza • Sistema de Telemetria e Relatórios', mLeft, fy);

        if (options.responsible) {
          doc.text(`Responsável Técnico: ${options.responsible}`, pageW - mRight, fy, { align: 'right' });
        } else {
          doc.text(`Página ${pageNum} de ${totalPages}`, pageW - mRight, fy, { align: 'right' });
        }
      };

      // ═════════════════════════════════════════════
      // PÁGINA 1: EXCLUSIVA PARA O GRÁFICO
      // ═════════════════════════════════════════════
      drawHeader(1);
      let y = HEADER_H + 2.5;

      // Caixa de Observações e Responsável (se houver)
      if (options.responsible || options.notes) {
        doc.setFillColor(244, 248, 246);
        doc.setDrawColor(180, 210, 195);
        doc.setLineWidth(0.25);
        doc.roundedRect(mLeft, y, pw, 8.5, 1.2, 1.2, 'FD');

        doc.setFontSize(7.2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        let info = '';
        if (options.responsible) info += `Responsável: ${options.responsible}   `;
        if (options.notes) info += `Observações: ${options.notes}`;
        doc.text(info, mLeft + 3, y + 5.5);
        y += 11;
      }

      // Rótulo da área do gráfico
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 72, 50);
      doc.text('Curvas Gráficas de Monitoramento e Telemetria', mLeft, y + 4);
      y += 6;

      // Gráfico ocupando todo o restante da Página 1
      const chartImgData = chartManager.getImageDataURL();
      const chartH = pageH - y - mBot - FOOTER_RESERVED;

      if (chartImgData) {
        doc.setDrawColor(180, 210, 195);
        doc.setLineWidth(0.3);
        doc.rect(mLeft, y, pw, chartH);
        doc.addImage(chartImgData, 'PNG', mLeft + 0.5, y + 0.5, pw - 1, chartH - 1, undefined, 'FAST');
      } else {
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('[Gráfico de telemetria]', mLeft + pw / 2, y + chartH / 2, { align: 'center' });
      }

      drawFooter(1);

      // ═════════════════════════════════════════════
      // PÁGINA 2+: TABELA DETALHADA DE SENSORES
      // ═════════════════════════════════════════════
      if (showStats && activeSensors.length > 0) {
        const cols = [
          { label: 'Sensor', pct: 0.28 },
          { label: 'Grandeza / Tipo', pct: 0.17 },
          { label: 'Unidade', pct: 0.09 },
          { label: 'Mínimo', pct: 0.11 },
          { label: 'Máximo', pct: 0.11 },
          { label: 'Média', pct: 0.11 },
          { label: 'Última Leitura', pct: 0.13 }
        ].map(c => ({ ...c, w: pw * c.pct }));

        let sensorIdx = 0;
        let tPage = 0;

        while (sensorIdx < activeSensors.length) {
          tPage++;
          const currentPageNum = 1 + tPage;
          doc.addPage();
          drawHeader(currentPageNum);
          y = HEADER_H + 3;

          // Título da Tabela
          const tblLabel = tablePagesCount > 1
            ? `Resumo Estatístico dos Sensores Monitorados (Folha ${tPage} de ${tablePagesCount})`
            : 'Resumo Estatístico dos Sensores Monitorados';

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 72, 50);
          doc.text(tblLabel, mLeft, y + 4.5);
          y += TBL_TITLE_H;

          // Cabeçalho da Tabela (Fundo Verde Oficial Koppert)
          doc.setFillColor(0, 72, 50);
          doc.rect(mLeft, y, pw, TBL_HDR_H, 'F');

          let cx = mLeft;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(255, 255, 255);
          cols.forEach(col => {
            doc.text(col.label, cx + 2.5, y + 5);
            cx += col.w;
          });
          y += TBL_HDR_H;

          // Linhas de dados
          const rowsThisPage = Math.min(rowsPerPage, activeSensors.length - sensorIdx);
          const startTableY = y;

          for (let r = 0; r < rowsThisPage; r++) {
            const sensor = activeSensors[sensorIdx + r];
            const stats = sensor.stats || { min: 0, max: 0, avg: 0, last: 0 };

            // Fundo zebrado suave
            if (r % 2 === 0) {
              doc.setFillColor(244, 248, 246);
              doc.rect(mLeft, y, pw, ROW_H, 'F');
            }

            // Bolinha com a cor exata do sensor
            const rgb = hexToRgb(sensor.color || '#24b35a');
            doc.setFillColor(rgb[0], rgb[1], rgb[2]);
            doc.circle(mLeft + 3, y + ROW_H / 2, 1.3, 'F');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.8);
            doc.setTextColor(30, 41, 59);
            cx = mLeft;

            const sName = sensor.name.length > 40 ? sensor.name.substring(0, 38) + '…' : sensor.name;
            const lastVal = stats.last !== undefined ? Number(stats.last).toFixed(2) : '-';

            const rowData = [
              sName,
              sensor.group || '-',
              sensor.unit || '-',
              Number(stats.min).toFixed(2) + ' ' + (sensor.unit || ''),
              Number(stats.max).toFixed(2) + ' ' + (sensor.unit || ''),
              Number(stats.avg).toFixed(2) + ' ' + (sensor.unit || ''),
              lastVal + ' ' + (sensor.unit || '')
            ];

            rowData.forEach((val, ci) => {
              const padLeft = (ci === 0) ? 6 : 2.5;
              doc.text(String(val), cx + padLeft, y + 3.8);
              cx += cols[ci].w;
            });

            // Linha divisória discreta
            doc.setDrawColor(220, 232, 226);
            doc.setLineWidth(0.15);
            doc.line(mLeft, y + ROW_H, mLeft + pw, y + ROW_H);

            y += ROW_H;
          }

          // Borda externa da tabela
          const totalTableHeight = TBL_HDR_H + (rowsThisPage * ROW_H);
          doc.setDrawColor(140, 180, 160);
          doc.setLineWidth(0.35);
          doc.rect(mLeft, startTableY, pw, totalTableHeight);

          sensorIdx += rowsThisPage;
          drawFooter(currentPageNum);
        }
      }

      // Download do Arquivo PDF
      const saveName = options.filename
        ? `Relatorio_Koppert_${options.filename.replace(/\.csv$/i, '')}.pdf`
        : `Relatorio_Koppert_${Date.now()}.pdf`;
      doc.save(saveName);
    }
  }

  // -------------------------------------------------------------
  // 4. FIREBASE & CLOUD HISTORY (Firestore REST API 100% Universal)
  // -------------------------------------------------------------
  class FirebaseHistoryService {
    constructor() {
      this.projectId = "koppertcvstopdf";
      this.apiKey = "AIzaSyCVIK1h3PFb_4PGAmDiGTNDmggT00uvgsQ";
      this.collectionName = "graficos_historico";
      this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${this.collectionName}`;
    }

    /**
     * Salva o gráfico e dados brutos no Firebase Firestore na nuvem
     */
    async saveChartHistory(record) {
      const isoDate = new Date().toISOString();
      const filename = record.filename || 'dados_telemetria.csv';
      const totalRows = Number(record.totalRows || 0);
      const sensorCount = Number(record.sensors ? record.sensors.length : 0);
      const sensorsSummary = (record.sensors || []).map(s => ({
        name: s.name,
        type: s.type,
        unit: s.unit,
        color: s.color,
        stats: s.stats || null
      }));
      // Limite seguro de 800KB para documento Firestore
      const csvData = record.csvRaw ? String(record.csvRaw).substring(0, 800000) : '';

      const firestoreBody = {
        fields: {
          filename: { stringValue: filename },
          createdAt: { stringValue: isoDate },
          totalRows: { integerValue: String(totalRows) },
          sensorCount: { integerValue: String(sensorCount) },
          sensorsSummary: { stringValue: JSON.stringify(sensorsSummary) },
          csvData: { stringValue: csvData }
        }
      };

      // Sempre salva também em cache local como fallback
      const localRecord = {
        filename,
        createdAt: isoDate,
        totalRows,
        sensorCount,
        sensorsSummary,
        csvData
      };
      this.saveToLocalCache(localRecord);

      try {
        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(firestoreBody)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn('Erro ao salvar no Firestore:', response.status, errText);
          return { success: true, id: 'local_' + Date.now(), source: 'local' };
        }

        const data = await response.json();
        const docId = data.name ? data.name.split('/').pop() : 'cloud_' + Date.now();
        console.log('✅ Gráfico salvo com sucesso no Firebase Firestore:', docId);
        return { success: true, id: docId, source: 'firestore' };
      } catch (err) {
        console.warn('Falha de rede ao conectar com Firestore. Salvo em cache local:', err);
        return { success: true, id: 'local_' + Date.now(), source: 'local' };
      }
    }

    /**
     * Carrega a lista de gráficos salvos no Firebase Firestore
     */
    async loadHistory() {
      const results = [];

      // 1. Busca documentos do Firebase Firestore
      try {
        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}&pageSize=50`);
        if (response.ok) {
          const data = await response.json();
          const docs = data.documents || [];

          docs.forEach(docSnap => {
            const fields = docSnap.fields || {};
            const docId = docSnap.name ? docSnap.name.split('/').pop() : '';

            let summary = [];
            if (fields.sensorsSummary && fields.sensorsSummary.stringValue) {
              try {
                summary = JSON.parse(fields.sensorsSummary.stringValue);
              } catch (e) {}
            }

            results.push({
              id: docId,
              filename: (fields.filename && fields.filename.stringValue) || 'dados_telemetria.csv',
              createdAt: (fields.createdAt && fields.createdAt.stringValue) || new Date().toISOString(),
              totalRows: parseInt((fields.totalRows && fields.totalRows.integerValue) || '0'),
              sensorCount: parseInt((fields.sensorCount && fields.sensorCount.integerValue) || '0'),
              sensorsSummary: summary,
              csvData: (fields.csvData && fields.csvData.stringValue) || '',
              source: 'firestore'
            });
          });
        }
      } catch (err) {
        console.warn('Não foi possível carregar do Firestore via rede:', err);
      }

      // 2. Mescla itens de cache local que ainda não foram sincronizados
      const localItems = this.loadFromLocalCache();
      localItems.forEach(localItem => {
        if (!results.find(r => r.createdAt === localItem.createdAt || r.id === localItem.id)) {
          results.push({ ...localItem, source: 'local' });
        }
      });

      // 3. Ordena do mais recente para o mais antigo
      return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Exclui um item do Firestore e do cache local
     */
    async deleteItem(id, source = 'firestore') {
      if (source === 'firestore' && id && !id.startsWith('local_')) {
        try {
          await fetch(`${this.baseUrl}/${id}?key=${this.apiKey}`, {
            method: 'DELETE'
          });
          console.log('✅ Documento removido do Firestore:', id);
        } catch (e) {
          console.warn('Erro ao deletar documento no Firestore:', e);
        }
      }
      this.deleteFromLocalCache(id);
      return true;
    }

    // ── Cache Local (Fallback Offline) ──
    saveToLocalCache(record) {
      try {
        const existing = this.loadFromLocalCache();
        const newRecord = { ...record, id: record.id || ('local_' + Date.now()) };
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
      this.showToast('Salvando gráfico no Firebase Firestore na nuvem...', 'info');
      const res = await this.firebaseService.saveChartHistory({
        filename: this.currentFilename || 'dados_telemetria.csv',
        totalRows: this.currentDataset.totalRows,
        sensors: this.currentDataset.sensors,
        csvRaw: this.currentRawCSV
      });

      if (res && res.source === 'firestore') {
        this.showToast('✅ Gráfico salvo na nuvem com sucesso! Disponível em qualquer dispositivo.', 'success');
      } else {
        this.showToast('Gráfico salvo no histórico local.', 'success');
      }
    }

    async openHistoryModal() {
      if (!this.historyModal) return;
      this.historyModal.classList.add('open');
      this.historyList.innerHTML = `<div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-secondary);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">☁️</div>
        Buscando gráficos no Firebase Firestore na nuvem...
      </div>`;

      const items = await this.firebaseService.loadHistory();
      if (!items || items.length === 0) {
        this.historyList.innerHTML = `<div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-secondary);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📂</div>
          Nenhum gráfico salvo no histórico da nuvem ainda.<br>Importe um arquivo CSV e clique no botão <strong>"Salvar na Nuvem"</strong>!
        </div>`;
        return;
      }

      this.historyList.innerHTML = '';
      items.forEach(item => {
        const date = new Date(item.createdAt);
        const dateStr = !isNaN(date.getTime())
          ? date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : item.createdAt;

        const isCloud = item.source === 'firestore';
        const badgeColor = isCloud ? 'background: #d8f3e2; color: #004832;' : 'background: #f1f5f9; color: #64748b;';
        const badgeText = isCloud ? '☁️ Nuvem Firestore' : '💾 Local';

        const div = document.createElement('div');
        div.className = 'history-item';
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-color); gap: 1rem;';
        div.innerHTML = `
          <div class="history-details" style="flex: 1; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <strong style="font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.filename}</strong>
              <span style="font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 999px; ${badgeColor}">${badgeText}</span>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${dateStr} &bull; ${item.totalRows || 0} registros &bull; ${item.sensorCount || (item.sensorsSummary ? item.sensorsSummary.length : 0)} sensores</p>
          </div>
          <div class="history-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-primary btn-sm btn-load-hist">Abrir Gráfico</button>
            <button class="btn btn-outline btn-sm btn-del-hist" title="Excluir da Nuvem" style="color: var(--danger);">✕</button>
          </div>
        `;

        div.querySelector('.btn-load-hist').addEventListener('click', () => {
          if (item.csvData) {
            this.currentRawCSV = item.csvData;
            this.currentFilename = item.filename;
            this.parseAndRender(item.csvData, item.filename);
            this.closeHistoryModal();
            this.showToast(`Gráfico "${item.filename}" carregado da nuvem!`, 'success');
          } else {
            this.showToast('Os dados brutos deste registro não estão disponíveis.', 'warning');
          }
        });

        div.querySelector('.btn-del-hist').addEventListener('click', async () => {
          if (confirm(`Deseja realmente excluir "${item.filename}" do histórico?`)) {
            await this.firebaseService.deleteItem(item.id, item.source);
            div.remove();
            this.showToast('Gráfico excluído do histórico.', 'info');
          }
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
      const title = (this.pdfTitleInput && this.pdfTitleInput.value) || 'RELATÓRIO DE MONITORAMENTO E TELEMETRIA';
      const subtitle = (this.pdfSubtitleInput && this.pdfSubtitleInput.value) || 'Koppert Brasil — Proteção Biológica das Culturas';
      const marginV = Math.max(5, Math.min(30, parseInt(this.pdfMarginV ? this.pdfMarginV.value : 12) || 12));
      const marginH = Math.max(5, Math.min(30, parseInt(this.pdfMarginH ? this.pdfMarginH.value : 15) || 15));
      const showTable = this.pdfIncludeTable ? this.pdfIncludeTable.checked : true;

      if (this.previewDimLabel) {
        this.previewDimLabel.textContent = orientation === 'portrait'
          ? 'Retrato (210 × 297 mm)' : 'Paisagem (297 × 210 mm)';
      }

      // Contar sensores ativos
      const activeSensors = (this.currentDataset && this.currentDataset.sensors)
        ? this.currentDataset.sensors.filter(s => s.enabled) : [];
      const rowsPerPage = 25;
      const tablePagesCount = (showTable && activeSensors.length > 0)
        ? Math.ceil(activeSensors.length / rowsPerPage) : 0;
      const totalPages = 1 + tablePagesCount;

      const isPortrait = orientation === 'portrait';
      const pw = isPortrait ? 210 : 297;
      const ph = isPortrait ? 297 : 210;
      const scale = 360 / pw;
      const mockH = Math.round(ph * scale);

      const logoSrc = KOPPERT_OFFICIAL_LOGO;
      const chartImg = this.chartManager ? this.chartManager.getImageDataURL() : null;

      const buildPage = (pageNum, isChartPage) => {
        const barH = Math.round(5 * scale);
        const hdrH = Math.round(22 * scale);
        const mL = Math.round(marginH * scale);
        const mR = Math.round(marginH * scale);
        const mB = Math.round(marginV * scale);
        const ftrH = Math.round(8 * scale);
        const innerW = Math.round(pw * scale) - mL - mR;
        const innerH = Math.round(ph * scale) - hdrH - mB - ftrH;

        return `
          <div class="preview-page" style="
            width: ${Math.round(pw * scale)}px;
            height: ${mockH}px;
            background: #ffffff;
            border: 1px solid #c8d8cf;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            flex-shrink: 0;
          ">
            <!-- Barra topo verde -->
            <div style="background: #004832; height: ${barH}px; width: 100%;"></div>

            <!-- Cabeçalho com Logo Koppert Oficial -->
            <div style="
              display: flex; align-items: center; justify-content: space-between;
              padding: ${Math.round(2 * scale)}px ${mL}px;
              height: ${hdrH - barH}px;
              border-bottom: 1.5px solid #004832;
            ">
              <div style="display: flex; align-items: center; gap: ${Math.round(5 * scale)}px; flex: 1; overflow: hidden;">
                <img src="${logoSrc}" style="height: ${Math.round(11 * scale)}px; max-width: ${Math.round(38 * scale)}px; object-fit: contain;" alt="Koppert">
                <div style="flex: 1; overflow: hidden;">
                  <div style="font-weight: 800; font-size: ${Math.round(8.5 * scale)}px; color: #004832; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
                  <div style="font-size: ${Math.round(6 * scale)}px; color: #4a5e54;">${subtitle}</div>
                </div>
              </div>
              <div style="font-size: ${Math.round(5.5 * scale)}px; color: #888; white-space: nowrap; margin-left: 4px;">
                Folha ${pageNum} de ${totalPages}
              </div>
            </div>

            <!-- Conteúdo da Página -->
            <div style="
              position: absolute;
              left: ${mL}px; top: ${hdrH}px;
              width: ${innerW}px; height: ${innerH}px;
              display: flex; flex-direction: column; gap: ${Math.round(3 * scale)}px;
              padding-top: ${Math.round(4 * scale)}px;
            ">
              ${isChartPage ? `
                <div style="font-size: ${Math.round(6.5 * scale)}px; font-weight: 700; color: #004832;">
                  Curvas Gráficas de Monitoramento e Telemetria (Página 1)
                </div>
                <div style="
                  flex: 1; border: 1px solid #b8d4c4; border-radius: 2px; overflow: hidden;
                  background: #f7faf8; display: flex; align-items: center; justify-content: center;
                ">
                  ${chartImg
                    ? `<img src="${chartImg}" style="width: 100%; height: 100%; object-fit: contain;" alt="Gráfico">`
                    : `<span style="font-size: ${Math.round(6 * scale)}px; color: #aaa;">[GRÁFICO DE TELEMETRIA]</span>`
                  }
                </div>
              ` : `
                <div style="font-size: ${Math.round(6.5 * scale)}px; font-weight: 700; color: #004832;">
                  Resumo Estatístico dos Sensores Monitorados (Página ${pageNum})
                </div>
                <div style="background: #004832; display: grid; grid-template-columns: 2.8fr 1.8fr 1fr 1.2fr 1.2fr 1.2fr 1.3fr; padding: ${Math.round(2 * scale)}px; border-radius: 2px 2px 0 0;">
                  ${['Sensor', 'Grandeza', 'Un.', 'Mín', 'Máx', 'Média', 'Última'].map(c =>
                    `<span style="font-size: ${Math.round(4.8 * scale)}px; color: #ffffff; font-weight: 700;">${c}</span>`
                  ).join('')}
                </div>
                ${activeSensors.slice(0, 18).map((s, i) => `
                  <div style="display: grid; grid-template-columns: 2.8fr 1.8fr 1fr 1.2fr 1.2fr 1.2fr 1.3fr; padding: ${Math.round(1.5 * scale)}px ${Math.round(2 * scale)}px; background: ${i % 2 === 0 ? '#f4f8f6' : '#ffffff'}; align-items: center;">
                    <span style="font-size: ${Math.round(4.6 * scale)}px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; display: flex; align-items: center; gap: 3px;">
                      <span style="width: 4px; height: 4px; border-radius: 50%; background: ${s.color || '#24b35a'}; flex-shrink: 0;"></span>
                      ${s.name}
                    </span>
                    <span style="font-size: ${Math.round(4.6 * scale)}px;">${s.group || '-'}</span>
                    <span style="font-size: ${Math.round(4.6 * scale)}px;">${s.unit || '-'}</span>
                    <span style="font-size: ${Math.round(4.6 * scale)}px;">${s.stats ? Number(s.stats.min).toFixed(1) : '-'}</span>
                    <span style="font-size: ${Math.round(4.6 * scale)}px;">${s.stats ? Number(s.stats.max).toFixed(1) : '-'}</span>
                    <span style="font-size: ${Math.round(4.6 * scale)}px;">${s.stats ? Number(s.stats.avg).toFixed(1) : '-'}</span>
                    <span style="font-size: ${Math.round(4.6 * scale)}px;">${s.stats && s.stats.last !== undefined ? Number(s.stats.last).toFixed(1) : '-'}</span>
                  </div>
                `).join('')}
              `}
            </div>

            <!-- Rodapé da Folha -->
            <div style="
              position: absolute; bottom: 0; left: 0; right: 0;
              height: ${ftrH}px;
              border-top: 1px solid #d0e5da;
              display: flex; align-items: center; justify-content: space-between;
              padding: 0 ${mL}px;
              background: #ffffff;
            ">
              <span style="font-size: ${Math.round(4.5 * scale)}px; color: #999;">Koppert Brasil • Parceiros com a Natureza</span>
              <span style="font-size: ${Math.round(4.5 * scale)}px; color: #999;">Pág. ${pageNum} de ${totalPages}</span>
            </div>
          </div>
        `;
      };

      let pagesHtml = buildPage(1, true);
      for (let p = 2; p <= totalPages; p++) {
        pagesHtml += buildPage(p, false);
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 18px; align-items: center; width: 100%;">
          ${pagesHtml}
        </div>
      `;

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
      try {
        window.koppertApp = new KoppertApp();
        console.log('✅ Koppert App inicializada com sucesso.');
      } catch (err) {
        console.error('❌ Erro na inicialização Koppert:', err);
      }
    });
  } else {
    try {
      window.koppertApp = new KoppertApp();
      console.log('✅ Koppert App inicializada com sucesso.');
    } catch (err) {
      console.error('❌ Erro na inicialização Koppert:', err);
    }
  }

})();

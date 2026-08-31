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
  const KOPPERT_OFFICIAL_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAp4AAAG/CAYAAADxbtedAAAQAElEQVR4AezdCZwjZZ3/8e+T7hkGZEBU/OuKgOCJCtPJAALijgLT6UEQDxQPvM918cJz8cDV9WBXRMUDXZX1XETFczo9HIt4cMx0ehgVRS4Bj1XUlUMZmO48/9+TZmCmp6uT1JFUJZ+8qjqdJ8/5fnL8UlWplMQFAQQQQAABBBBAAIEuCBB4dgGZJhBAAIFoAe5BAAEEBkeAwHNw5pqRIoAAAggggAACPRXIZeDZUxEaRwABBBBAAAEEEMhEgMAzE1YqRQABBAotQOcRQACBTAQIPDNhpVIEEEAAAQQQQACBuQIEnnNFom6TjgACCCCAAAIIIJBIgMAzER+FEUAAAQS6JUA7CCBQfAECz+LPISNAAAEEEEAAAQQKIUDgWYhpiuok6QgggAACCCCAQHEECDyLM1f0FAEEEEAgbwL0BwEEOhIg8OyIi8wIIIAAAggggAACcQUIPOPKUS5KgHQEEEAAAQQQQGBeAQLPeVlIRAABBBBAoKgC9BuB/AoQeOZ3bugZAggggAACCCDQVwIEnn01nQwmSoB0BBBAAAEEEOi9AIFn7+eAHiCAAAIIINDvAowPgaYAgWeTgT8IIIAAAggggAACWQsQeGYtTP0IRAmQjgACCCCAwIAJEHgO2IQzXAQQQAABBBCYFeBv9wUIPLtvTosIIIAAAggggMBAChB4DuS0M2gEogRIRwABBBBAIDsBAs/sbKkZAQQQQAABBBDoTKDPcxN49vkEMzwEEEAAAQQQQCAvAgSeeZkJ+oEAAlECpCOAAAII9IkAgWefTCTDQAABBBBAAAEEshFIr1YCz/QsqQkBBBBAAAEEEEBgAQECzwVwuAsBBBCIEiAdAQQQQKBzAQLPzs0ogQACCCCAAAIIIBBDIMXAM0brFEEAAQQQQAABBBAYGAECz4GZagaKAAJ9L8AAEUAAgZwLEHjmfILoHgIIIIAAAggg0C8C/R549ss8MQ4EEEAAAQQQQKDwAgSehZ9CBoAAAgjkWYC+IYAAAvcIEHjeY8F/CCCAAAIIIIAAAhkKEHhmiBtVNekIIIAAAggggMAgChB4DuKsM2YEEEBgsAUYPQII9EiAwLNH8DSLAAIIIIAAAggMmgCB56DNeNR4SUcAAQQQQAABBDIWIPDMGJjqEUAAAQQQaEeAPAgMggCB5yDMMmNEAAEEEEAAAQRyIEDgmYNJoAtRAqQjgAACCCCAQD8JEHj202wyFgQQQAABBNIUoC4EUhYg8EwZlOoQQAABBBBAAAEE5hcg8JzfhVQEogRIRwABBBBAAIGYAgSeMeEohgACCCCAAAK9EKDNIgsQeBZ59ug7AggggAACCCBQIAECzwJNFl1FIEqAdAQQQAABBIogQOBZhFmijwgggAACCCCQZwH61qYAgWebUGRDAAEEEEAAAQQQSCZA4JnMj9IIIBAlQDoCCCCAAAJzBAg854BwEwEEEEAAAQQQ6AeBPI6BwDOPs0KfEEAAAQQQQACBPhQg8OzDSWVICCAQJUA6AggggEAvBQg8e6lP2wgggAACCCCAwAAJlAZorAwVAQQQQAABBBBAoIcCbPHsIT5NI4AAApJAQAABBAZGgMBzYKaagSKAAAIIIIAAAr0VyGfg2VsTWkcAAQQQQAABBBDIQIDAMwNUqkQAAQSKLkD/EUAAgSwECDyzUKVOBBBAAAEEEEAAgW0ECDy3IYlKIB0BBBBAAAEEEEAgiQCBZxI9yiKAAAIIdE+AlhBAoPACBJ6Fn0IGgAACCCCAAAIIFEOAwLMY8xTVS9IRQAABBBBAAIHCCBB4Fmaq6CgCCCCAQP4E6BECCHQiQODZiRZ5EUAAAQQQQAABBGILEHjGpqNglADpCCCAAAIIIIDAfAIEnvOpkIYAAggggEBxBeg5ArkVIPDM7dTQMQQQQAABBBBAoL8ECDz7az4ZTZQA6QgggAACCCDQcwECz55PAR1AAAEEEECg/wUYIQJBgMAzKLAigAACCCCAAAIIZC5A4Jk5MQ0gECVAOgIIIIAAAoMlQOA5WPPNaBFAAAEEEEBgswDXXRcg8Ow6OQ0igAACCCCAAAKDKUDgOZjzzqgRiBIgHQEEEEAAgcwECDwzo6ViBBBAAAEEEECgU4H+zk/g2d/zy+gQQAABBBBAAIHcCBB45mYq6AgCCEQJkI4AAggg0B8CBJ79MY+MAgEEEEAAAQQQyEogtXoJPFOjpCIEEEAAAQQQQACBhQQIPBfS4T4EEEAgSoB0BBBAAIGOBQg8OyajAAIIIIAAAggggEAcgTQDzzjtUwYBBBBAAAEEEEBgQAQIPAdkohkmAggMggBjRAABBPItQOCZ7/mhdwgggAACCCCAQN8I9H3g2TczxUAQQAABBBBAAIGCCxB4FnwC6T4CCCCQcwG6hwACCNwtQOB5NwX/IIAAAggggAACCGQpQOCZpW5U3aQjgAACCCCAAAIDKEDgOYCTzpARQACBQRdg/Agg0BsBAs/euNMqAggggAACCCAwcAIEngM35VEDJh0BBBBAAAEEEMhWgMAzW19qRwABBBBAoD0BciEwAAIEngMwyQwRAQQQQAABBBDIgwCBZx5mgT5ECZCOAAIIIIAAAn0kQODZR5PJUBBAAAEEEEhXgNoQSFeAwDNdT2pDAAEEEEAAAQQQiBAg8IyAIRmBKAHSEUAAAQQQQCCeAIFnPDdKIYAAAggggEBvBGi1wAIEngWePLqOAAIIIIAAAggUSYDAs0izRV8RiBIgHQEEEEAAgQIIEHgWYJLoIgIIIIAAAgjkW4DetSdA4NmeE7kQQAABBBBAAAEEEgoQeCYEpDgCCEQJkI4AAggggMDWAgSeW3twCwEEEEAAAQQQ6A+BHI6CwDOHk0KXEEAAAQQQQACBfhQg8OzHWWVMCCAQJUA6AggggEAPBQg8e4hP0wgggAACCCCAwCAJlDRIo2WsCCCAAAIIIIAAAj0TYItnz+hpGAEEEJgV4C8CCCAwKAIEnoMy04wTAQQQQAABBBDosUBOA88eq9A8AggggAACCCCAQOoCBJ6pk1IhAggg0AcCDAEBBBDIQIDAMwNUqkQAAQQQQAABBBDYVoDAc1uTqBTSEUAAAQQQQAABBBIIEHgmwKMoAggggEA3BWgLAQSKLkDgWfQZpP8IIIAAAggggEBBBAg8CzJRUd0kHQEEEEAAAQQQKIoAgWdRZop+IoAAAgjkUYA+IYBABwIEnh1gkRUBBBBAAAEEEEAgvgCBZ3w7SkYJkI4AAggggAACCMwjQOA5DwpJCCCAAAIIFFmAviOQVwECz7zODP1CAAEEEEAAAQT6TIDAs88mlOFECZCOAAIIIIAAAr0WIPDs9QzQPgIIIIAAAoMgwBgRMAECT0NgQQABBBBAAAEEEMhegMAze2NaQCBKgHQEEEAAAQQGSoDAc6Cmm8EigAACCCCAwD0C/NdtAQLPbovTHgIIIIAAAgggMKACBJ4DOvEMG4EoAdIRQAABBBDISoDAMytZ6kUAAQQQQAABBDoX6OsSBJ59Pb0MDgEEEEAAAQQQyI8AgWd+5oKeIIBAlADpCCCAAAJ9IUDg2RfTyCAQQAABBBBAAIHsBNKqmcAzLUnqQQABBBBAAAEEEFhQgMBzQR7uRAABBKIESEcAAQQQ6FSAwLNTMfIjgAACCCCAAAIIxBJINfCM1QMKIYAAAggggAACCAyEAIHnQEwzg0QAgQERYJgIIIBArgUIPHM9PXQOAQQQQAABBBDoH4H+Dzz7Z64YCQIIIIAAAgggUGgBAs9CTx+dRwABBPIvQA8RQACBzQIEnpsluEYAAQQQQAABBBDIVIDAM1PeqMpJRwABBBBAAAEEBk+AwHPw5pwRI4AAAggggAACPREg8OwJO40igAACCCCAAAKDJ0DgOXhzHjVi0hFAAAEEEEAAgUwFCDwz5aVyBBBAAAEE2hUgHwL9L0Dg2f9zzAgRQAABBBBAAIFcCBB45mIa6ESUAOkIIIAAAggg0D8CBJ79M5eMBAEEEEAAgbQFqA+BVAUIPFPlpDIEEEAAAQQQQACBKAECzygZ0hGIEiAdAQQQQAABBGIJEHjGYqMQAggggAACCPRKgHaLK0DgWdy5o+cIIIAAAggggEChBAg8CzVddBaBKAHSEUAAAQQQyL8AgWf+54geIoAAAggggEDeBehfWwIEnm0xkQkBBBBAAAEEEEAgqQCBZ1JByiOAQJQA6QgggAACCGwlQOC5FQc3EEAAAQQQQACBfhHI3zgIPPM3J/QIAQQQQAABBBDoSwECz76cVgaFAAJRAqQjgAACCPROgMCzd/a0jAACCCCAAAIIDJRASRqo8TJYBBBAAAEEEEAAgR4JsMWzR/A0iwACCNwtwD8IIIDAgAgQeKY90aMjn1C1fEvC9Ztpd6tr9VXLZyQc+3x2f7M6vcbKz+3aOGgIAQQQQKB7AmMja+x1fr7X/1ZpH+9eJ2kpDYG8Bp5pjK03dTjdzxpemnB9gJUv3lItn26dfrmtScc/t/wO8jpN4/UviwsCCCCAQB8KuAfaoOa+9rdzO7znWlGWoggQeKY9U87dlkKVt6RQR3erqJZPtQZfbWv6i9Ppmqi/Pv2KqREBBKIFuAeBLgp4f3Os1rzSeM+N1TSF4gkQeMZzo9SWAtXyKXYzm8DQ6yzb0nmC1c+CAAIIIIAAAgUXIPDsYALJOo/AWPkkS32TrVksF9iWzuOyqJg6EUAAAQQQQKD7AgSe3TfvnxbHyq+T13szGtAlqtUPy6huqkUAgWIK0GsEECi4AIFnwSewZ92vll9hQeeHM2r/lxZ0HpRR3VSLAAIIIIAAAj0SIPDsEXxqzfaiotHyP1uzn7I1g8X9Rou3PyCDiqkSAQQQQAABBHosQODZ4wkoXPPVkePk9LGM+n2zZhoH6js/vjWj+qkWAQQQSF2AChFAoH0BAs/2rcg5uuwpkvuqsrncqcb0iM6d+l021VMrAggggAACCPRagMCz1zNQlPar5afJlb7VXndj5HKlx2nNhutilKQIAggggAACCBREoFSQftLNXgpUy6PW/DdszWZxfoXG101lUzm1IoAAAgMowJARyKkAgWdOJyY33Rpbfoj1pWZrRos/XONTP8iocqpFAAEEEEAAgRwJEHjmaDJy15XR5QfINy7Irl/+OapNnZ9d/VvVzA0EEEAAAQQQ6LEAgWePJyC3za9atkyucbH1b7GtWSwvsqAzqy8qZdFf6kQAAQQQSCRAYQQkAk8eBdsKVJc/Qo1SCDozeny4V6tWP3PbhklBAAEEEEAAgX4WyCiw6GeyPh/b4ZXdpcY6G+USWzNY/ImqTX4ig4oLWSWdRgABBBBAYJAECDwHabZbjfXIx+6iYR+Czh1bZY13v3ubalOnxitLKQQQQAABBFIXoMIuCxB4dhk8t80ddsB9NbMonNJo10z66Px7bEvnBzKpm0oRQAABBBBAoBACBJ6FmKaMO3n0IUu1aPoya2UPW9NfnN6ngK2REAAAEABJREFU8al3pl8xNWYiQKUIIIAAAghkJEDgmRFsYapdsWKJ7rz9EuvvXrZmsPgPaLx+UgYVp1Plk/d7kMJpo0bLz1S1fLKtp9v6eVVHvmbX39FoeXVzrZbD//+tsfLnbD1No5V3aKxyjFaWK1q1/wPS6Uyf1xKOH1657GCze6nGyv+msconzflMVStfmV3LX9Jo+bO2ftjue6eq5adqtFLW2Eg2W+GLzL1qZA+Fc+xWyy83w/eZ1Rlm9V+6x/KL2my5+bE6tnxEYc9GkcfdSd/Dc7u6bH97/DxD1fK7NFY+zdbP2f9fVbXyLXP7/uxa/p5ZnaNq+auz91c+amX+1W4/T9XK4+2+h+rYfbI6u0cnI8p/3pNV0sp976WwMWO+Ndyf9ihKujXtKvNQXz/3gcCzn2e39dicltzyI8u2j63pL06nqDb1tvQrTlDjyv0fbG82z1a1fKqtP9f00PVyjUvldJbV+i5bX23rCyV3rKSjLH2suc7+/yx5vcjW18r5f5X359jL7Do1Zm6wui5TtfIeVctPa77wWuGeLuEFPvSlWn6eRivPaX8dOd58jk6t76PlqpoulZ9p2P9apdKPze4zZvgv5vdKyb1A8s+eXfVcOb3Y1tfZfe+W9E3LOynvbrRAYI316w1aVTnQ0ru7hDfSYDhWfm77jsE8WJbDr36l09/RypFm8H5Vyz9Xw/1avhGeu2dI7m2SXm5Wz591DJ56njnOWm5+rPpG3fZs3Kjmh6nKay1wHbFy/bOM7bubBY42R+UPm9GG5nNbpcvs8XO2DfJkeb1W4fkrHWdOT5HcqtlVR5rVMQrpzfv9CfLuHXb7i5bvh3bfVbp1yY1mbx9GR96glcuPsPu6v4TxVSvHanTk6Ta+p7W9jo1Y4L3cxmojSavXK8MHSHt8j428xfrzCevLebau1yWV6+WGf2MbM34773rJst3T6sLd9XjtpVUjy2c3ICw/IP3r8qEKH5rvbpB/kgoQeCYVLHL5avkn1v2KrRks7mO2pfMtGVTceZVh61C1/Ap7wz1HpZlrJfcVSa+3NQTcQ3addFlkFexvb1Jvt+tvqDR8rarlsMXpmc1P/pbY9eXSh4Y+hZ85/aIFJF9uf3VfkNzXlORy5P572fjD1uO6nMZnXfyjrUpna5xlO3lnb/buQ2r4S6zui2x9vQX4949TWcdlhhY9oOnn9aXmtfNtegZLfbnj9rYssGq/h9vj9r2qWuDu/Pck91ZJ4XFrV7GW7W1O7MOUP80C17qq5fNVrfyTRg+6T6zael1oNhiz/pfPkbfnXXOO9DpJj7U1jee2VdNc7q/mh1F7DJYa9iGocqXNy6ftA9GYjj02zXYUefFD9iHGf03Ofd3yfKPt1TsLvBvfV6UybGXiLasqj7XA+w32WDlb1fJ1an6AdF+wAP0D1p9XWaWH2bqfPdd3k9O9JS2dd53RIktPeznKPoitVXMDQtiIkPaqi+xD80lpd3qQ6yPwHNTZr5YvsKE/ztb0F6dTVJt8TfoVd1jjWPlx9iJ5hr0oXWclP2UviGGrRvwXX6ukzcXepJpbnM6yT/3X2ZvTv+qIZQ9rs2w62XZc7K2im2yNs/wp1ptp2CowWv6wZmausUbfZWtWW9QOtbpPtQD/Opvfk813V7ud3eIa07Er9/pjrLLNgHPkE2oMXWmPW3vTawbusapqUehJkv+43B3XKuySP2ZZCBpaFMnB3dWRg2zuz7Bg057bof8Kz+0sghrNf/EPt3l5mQVeq3XbNcHuxC4cxvD3+fvSVuoftXRpeE1oK3Mz07EHbW/B5ks0Wv6BGn6DZEG3/DMk7am4l8WLZuIW7XG5TT1uPx/Np9QLAs+UIAtVTbVsW6H0xEz6HILO8Xpvt3SG3bFhS47XxTbGl9sad0ubFU283NfenN6hodKv7I3y8wq7+hNX2XYF8V7knR/WTTd19iYedrkN+6vlFLY2qUuXHaydd5nvNRZ8nqA8XkrqfA7CscbNgNOFLUndGtXOCrvkN7pr7HEanjPdarezdsIxv9XyhOR+Iin0sxsfJK2pBRav3c3uP7Ro+jqFw0pWrMjoHMjqLHDcusvtPw6bAWf5TbptowX17j/tOf2ErasawFtemwZw1JkNmcAzbVrv821aLddsyFVbM1h8+CJR74LO2V3q37RP55fY4GxLjv3N1/JC29Vvb+wj789Xt+b0xjuv7X/T3ptc+JWravliefcBq6WzYNUKpLQstfY/qmr5h10+Fqt1971b3DrTXTlGR/azMUzarXfZ2qPFhV3uZ1g/ztVhB/6/HnVi22bDlthq+QsW4AWfldtmyEWK7V72b9eSW36lcExwLrrUYSfGyi/TrXdcbaVOsedUfubfOsTSPwL5DpIK6Wxv2nntd/jWpjSaSfe8+2BPv0hUHXmJGu5KG9tTbc3zYsGZe6u9sf9S4QD9fPZ0B5W2D1sTF+5dNXxhofFTy5TNIRtWcYfL4zXsf2Fv+kd2WC677M63t7V9bOQZcm69daRsax6Ww7Xozis0Wg6HNfS2PyvLT9bG0lXWieNtLcLyYAuQv2zP8c8XobPNPoYzc4Rv+nt92m7/g60sCGQmkG7gmVk3C1Xxn3LZ22r5i9av42xNf/HunZqYfGv6FbdR41GVHezNcbVku4Sk7VScyyNUKv1Y4bi6/PW5pI3bL/zaEAJ9Nb5vXbdA2v7mZ9nB3vS/Z2/6r8hFl7xcy36MVl5rW5fObpmv6xncfaz3F5nl87re9OYGq+VTVNJ37eb9bC3a8kKz26AjRvIdyIVvyTdmfiX5pxQNmP4WU2DhN5dijqm3vXb+ht52YJ7Wq+UzLDWjNw9/ogWd77H6u79Uy/tqk35mb45j3W88pRbDcXXhHKH5Ok/gkIY2DkWOsFp+uWYDfeX48ilVK73/gpvTwrvaR8tvtkD5tDQdM6jri6qWX5hBvdFVrlgxrHDaJ+lN0ZkKcc9jNeQ2KBybmsfujpU/qNlvyS/NY/foU38KlPpzWD0cVaP0sx62vm3T4XyVswfhb3tf4hT3Wtu9fmriauJUUB0J55q0XZP+IXGK56zMUbp1+7q9OT0wJ/3aXqXSDvP2pVp5gaWHDzJ2lffFf0Rj5Zf1tJdePrL90fKL5PTByPvzdUf4UYVs9pjMHefhlZ213a1rzaa4Hyi3HtN97cPFpQpnKtg6vZe3nEbL59ij88297ARtD6bAAASeXZ7YRdO/sifzX7vc6vzNjY38h93xelvTX7xerNrkR9OvuI0am0Gn+7blbL0b0zIVY/GPtjfay3RUJR+7FBvznPZkZbliu+POLIbnXb0Mx6ytXHbwXbd6cTWsk7Xt6+zYyD/afH9Ohbq4r2rl8sdk3uVh/0ML1JZl3k53GxhWY+gSe37P/4Eu+75M68ILZ08LFn69qlqetMdfOAVV9i3TAgJzBLZ9QZyTgZsdCty2yx+sxO9t7e1SHXm7vDsxo048XRP13hw4P1Z+ktQMOtWFS/gptj9ZO2G9xa4zXvxu2uTX6sjH7pJxQ62r95uWbJUpnCS7pPO3SivKjVJpjVZkdoqbVgqL9PN9tj7lz4p9drTn5vdaFczl/aXGuQqn2+m0c+3mnz2/8GPbzd5mvk2Wb9LWT0u2l8bpOHl/hEp+f5VmHiGVHmlB2EFyLnzx8nibmzdK+rKtv7Q1zWUXe36H41XTrLPdunZpnvFhZeWRWjxdt0JZnWPXqmZBYGEBAs+FfTq/N3yqdPqfzgumWKI68gbJZXHc5R32Iv1E1erfVC8uo/s9Wj6z4Ocn9mb0SXn3OjkdJjUeosXbP0gbd3pwc128/W7yepgapZW2Neat9n/YWnV5Bgx7anrxBRnU21mVi4a2Djxvuyb8pOjOHVXidJXkvm6eH2maOW+76f1zzO7FzdvShyX9t+R+rmwv99KSm8MvvWTbyny1O+917fZb725fsiRsrd9xvuwLpF0p+fAFpA837WYtn23/v0ReJ9l6mpX9mq1pB0tW5VbLA3TrHeGxv1ViKjdGRz5h9aR4fmF/mbm8RcMzD7HXrOW2vqK5l2a8fpYmps7T6ql1Wn35r1Rbd6XG65dofHKN5fmSJiY/ZNfPs/VRcqWyuYc9O/+rdC5PUrXSiy9i7qhhf60F278wk93TGUqMWjY1Fj7mOUaVXSnilO2PVHRlEPlphMAzk7lwX21RbXZ3j1ZOVPMXJpT25UaptJ+9SF+YdsVt1Re+ve6Gwgnh28reZqa19qbyUnsx3tPeZA6xN6N/sjedj9ib0AWqrf+1vvPjW2331MbmGv6fqF+tNevO1fjUBzVRf4mVWdbcYhLe+KVw7rs2m22Rzfllmj31VYuMGd7tG/eccHq0XLU3q6e32dqk5T1BDfcojdcfrtrksXb9OgWz8akvqDb1VbP7fPN2rf4G1erPtjyPUWN6Lyv3YmsjnBjcrtJe3CozfV7atbasz2uR9lo8fHe+0fIz7X/bam9/Wy4WOEmvbD7GavVHqjb1TAWzeyz/2xw/Z57vs/X1dt+zbH2UOT7Mgv2X22P7spZNxMtwnMZG0j3+sjpynJx7VbzuzC1lbmGLZm3qQHM5Rd+7/Ldzc7R9e3zdlGpTr9XS7cLj8yQrd6etCRf/fo1WenE891BExzfaYyYEpBepuTfJPixKYeNCeqvXtySdo5nh/7PrdBfnbS+jD+9LP7SKM1j9j+0D3qVWN0tKAgSeKUFuVc1NCg/SLuya3apV2RvrK+wJEo7rnHNH4puXyC16jMKWgcRVxaxgk/+OlUznm5fOn2tBdNhye4C9qXzWtnxcb3XHW8IWk4n6+1SrP0xyz7T1V0rncpy9Ob00napi1NIozW7xPFklOYVTcbWoxP+XSu5x5rDc3uxP15rJzra8rdlwnZX7vJU/RL50oDX2JVvTXj6nsYdul3alC9fnnG7+W6mZJ7Tt9IXm/wv9ce5TKjVGFAKnWv2M5la5hfLPvS98QBqvf6ZZ3ukgu/u/bU138e7LqVmGQw9k9aXTw1c2xx22aLasr4MMZ198uz0+36eSf7i8Luqg5PxZnc/i8T1/W1GpTt+w5/Zx9qFvDxvbPrb+o2qTx9h6rGr1p6e6TtSfavU9TedfakFiVIdipnsLlGtTT7T6n5DNOvV4+4D3sZi9o9g8ArMviPPcQVICgcnJTba14ZwENXReNGwxkD7VecGWJb5pT+aDNH7pLS1zZpVh9pvJh6VQ/d+sjuPtRWSlauvCJ2S7meJSmzxbj5t8lNWYTvDv/Gc0duBOVl/3lyHZY9iavbhykv29n61Ry4/szesg1aZeqNWTl0Zl6ih9Yt1lqtWPV/OYO3ddR2UXzrxI2rn7v6y1ZkN43NlLwtJTrHvb2Rq1nK8QcI5Pvkqr16+PytRRetiFHLYqqxROqh9/y9+2je4i7XzCtskxUpYsCcF40veimxQ+sIRAPUYX2i6yeur6ZoAmhcMa2i42T8YnaWz5IfOkdyPpenn3JI3Xn2HrWVVznG8AABAASURBVFqz4Y/daDSzNnyLU5Zl1jAVxxVI+mSP227/l3Ol93RtkOFXT5R89/42/Q0nhq/ZJ99t7uhiwuhB95HXJ1Jo8RLN2NaKWj3bLQ0nq2FB05uaW1Sl2YAjSef9pu5+gNnc18UzNzb/DecZbf4zzx+vf7axHmpvXpfMc2/ypHDM3dLbHynvvpC8srtq8P5dCqfruetmF652vKcN95p7/p/7n3+pWR6eWsA5t/rautW2ZesRlhx2n9pVCov3b1elYsF8grqqy1dY6aS/Nna97el5tMIHFqusK0ut/ixrJ3wBya5iLr7xzpglkxS7Uhs3PkYTk/+TpJKclY06hCBn3aQ7mwUIPDdLpH09PnmNmsfLKNtLtfw0e2M+O9VGwjEz3j3ZXpy6FzxHDcDdEb49f88xclH5Fkp3/iv2pn6Qzp363ULZUr0vbFGdsd2lUtI2n6TRZd3/RZGNpXNVLa+NMLEtJP5g2/Lz8Yj700s++4o77XH4Ajm9PaVKS1rUeKW6d1nUdKyW59+C6XSD1Jg95CPrPoUtr+GDpNP7UmpqZ+2qVyWrq/HJROW9/mofKA/W+NRN6valVn+evH6RoNmVqi7bc075LG96lYZW6MIrbsuyEepGoJUAgWcroST3D0+/OknxlmVHK2H32Tda5usogz9bw6XH2Jv99zsqlkXmI8tht3U4UXz82sNB7eNTz41fQYKS566/Sm76QHtzSnZeV1f6bIJexC263AqG1a62Wq6Ud8tUm7p4q9Ssb4zX/83aTWcLkXfheemy7vIW9QfH/ba4vfnfX2rYVVRbHxXgb86X7vV4/STJfyClSl8Xu57RkcOt7CNtjb+USk/u6gfKuT1dNHOEJc3YGnMZOiFmwTjFPq3Va9P6dn6c9imDQFOAwLPJkNGf8G1KrxdnUvuqkSfY7qXvpVj3L+3N6NkWUDxT350M561MseqYVc34Tyhm0buKXWFb5ZLuxrurqphX4xt+I186NGbpzcXuq9ljeDff7tG1/4um3YH2oeT3PenAxGTYAn9mCm0/WGPlJ6dQT5IqfqvF2x/Qs+dabeptSmWPjH+IVo2EwFodX5xLGPz692t83Y87bjfNAuE1Xv6UBFV27/XJz/AFmQQTRdH0BAg807Ocv6aJ5onWvzz/nTFTq5Vj1XA/iFl6TjF3nW1JeqNq9UepNpX+t1/ntNb2zdER20LkwvFfbReZk3HGgqR0T/kyp4G2b65Z9zML6l/adv55M7r3z5vczUSnQ3Xe5M3dbHKbtmr1F1mafUiyv4kWf1yi4kkLe61onq5LPbws3evpkvuNkl4aCx27GlH5qpE97J6KrfEWpxvs9epf4hVOudTSJe+xGmM+Lyxwr3Zld/vtumPT9dbPWAuFEEhTgMAzTc2ousKxQNJ5UXd3lN48ObxP+o3K0OQl8v5Vqk3uZVuwPhQScrW6UsJj+uzN8LzJG3IzptpU2F3+owT92dO2eqbxzf54XQiPlfGpK+IVTrtUI/kHCu/CYSppd6y9+ryeZVvir24vc4a5zj7bdhH7NByqHffS6yUdl9mygPdv2fJmT/8Pp1qSj/8FSD/UjWO4LTC+/8aeOtE4AncJEHjeBZH5Va1+hG31iv8loPBN3NHyOUp2cnh7s3Mfa56ypVY/SBNTWZx+SYkvx+6z2KyOSVDPlRZQx38jaNlwzAxu+tkxS95VzL38rn+6e+V1aa4eK7X1vzaApPO7s8YqK62ebi/na6KexgfHdPpdq2+wipKe6WFXjZWPsnraX3ySk8XbVto87Z0Jo57xnw9XsVbnuxF4NrTrrj5W/yiEQMoCBJ4pgy5YXfjlEe/euGCe2TvvnL266+9o+dUa9lfJqfNgzLv18jpJJf+PCic5r02+JrNTtiilyy1LwpeBhuPXVurmt5bb72Y43rP5E5HtF5mT86k67MD/NyetGze7/4s/rUZ1k3udZbnD1vhLwz8jfuGYJZ1P+OEjZrsLFds0nNzS6wkLNbHVfaOVst1e6NywdvcCi9NHFri3N3edu/4qa/intsZZHhKnUIdlnG66yXVYJt/Z6V1hBQg8uz11E5MfUkPhYPwfRjftlyps9RsrP0mj5UvkdLrl3dXWVks4pcikBZqfs4xPU/gZwonJEdvC8j6tnrrI0oqxOL0gQUcvVziVUYIKsi3aeFuC+hdp8abwTeAEVXRc9Jv2+LEt5R2Xy7ZA80caXLItdU6PzraT29T+iZ6c9mebbsxJOP+yP8sr6XHoB8+pNfqmU7ItzaVSeucije5l5/d4xX087q6V+96/8wYpgUAxBQg8ezFva+qTtvXxCRZQHqTZLaDhi0J/vqcr7lDdtt0N8jrf8hx4V/rtdn29rXVLtyDSfVbOv1VyL5S3LTchmHW3PNjqXW6Bwkvs+hyFnyFUwS5HH7LUenyArfEWp4/HK9ilUrXmbuKp2K15PS2ibDbJzr05m4pTqNUp6ReuDtDYSDsf6FLorFXh3Xvtbz4X10h62M1I88NyW6NrhC2ebeWcJ9P1+v7aa+dJ732S1xUxO1FSabhXv2IUs8sUQyC+AIFnfLvkJcPP2d1x+xly7gKrbMtzPQ7Ju7m7VKcl/xt5TUruO1Ljq7pz8ZmqTf6XJqa+oRDMjl+dbNejcnDZeMfjrBfb2xpvaWz3jXgFu1jK+fjHg0lH69iD4vt0Nsy1av4QQmeFupZ7tm/1BO0Ny7tDE5TvpOhaTUz25jRU7fSytj6cSzTuruLQwvb6+5K9wz8LrkdVdpDcqGJf/LdjF826oNvuJ9bE7E/N2j+dLb7bW9876x652xQgWzsCBJ7tKGWRJ3yxoVr+ppYsudW2WL7bmtjiRdtdJ6fXW9qErZsX2xLoDpHTy2xL539I7jwt2vS/qpb/ZutPVK18RWPlf7MtOGO2e/6hKurFNX/tJ17vnb6niYv/Eq9wF0st2uFMay3mG5SGdfMd+1j5Liwun7s0txy5VzisZMuUzv532r2zAjFzO396zJLdK+Z0VqLGZtQ6iN+ksLVzp9jteDceu2zWBcNrj1fMD0LuPll3j/oRyIsAgWe3Z+KYZfdWtfxVCzZDUBlx8mC/XuP102x3eVW+Eb5QtNAunB1sCAdJ/tny+hd5t9qC06ssCP2VtXOqqiPPVm++kGLdirE4rYpRarZIQ8F09v88//3Oj2+1OboydhdL9gEkduEOCjZc4h8o6KC1eFkXzXwrXsG7Snl1J/Ccmand1WJ+rxq6KFnn/P4ty3v/Dy3zLJTB6XcL3d3z+5yui9cHbxsW4pWkFAJFEyDw7OaMVZev0MahsDvruBbN3rMrdWL9ty0Atd0wrrPjw7weZm3YVlP3Fdsyep2qlbM1OvJKrdy3G9+gtKZjLJXKIiu1zNZ4i3Pr4xXsQSnv1sRu1fkwt7GLt1XQ6So1T3zfVu7eZWr+coyS7MLetwudv1prNvyxC+0ka2KiHr7w+Nv4lbgHtixbar4utcwWkWHaXgvD6Z8i7s5BstMN8XrhdoxXjlIItBTIXQYCz25NycrwE32N/7Etk7u10aTbJk9t8h1W9mDF+6URC2T9M+TcJ1UavrYZhFZHjlbeLvffFI5r3Tlmt/6ujUvXxSzb/WIuwdZZrwd1ocPxt8h2oXNbN+GTnJi/dbC0dWNxbl0cp1BvyvjL47fr792yrFfY1d4y2/wZ/C2qlvdVdfkjtLLyyNytY5W91dAu8/e9Vaqz1+hWebgfgf4QIPDsxjyOVp6okr6buKna1MVqbHqkBaAJf5/YP0Phd5qrlSs1NnJC+99GVbYXN/SABA38ThdeWJxf5mhMJ9iypEclcGqvaEP5O4VSZM/dryPvmu+OLdOcurGl6Q9bNpnv/92N8fvnWgddTg9PUH8IbC0wbvxSJf+L3K3eX61wDH6sAfrhWMUohEABBQg8s560ww64r5xP74D4NRv+ptrU4yX3dSW++IfLu4/q1u2vUbXymsTVJa1gppTgTcn/JmnzXS0/veRPCdrbW6MH3UeZXtzPM60+zcq9ix/YeS3twlkCfpfmcDOtyzkL7GK3cH+tWLEksvTJ9vFbPsnpq/r3/crJR7pxBwJ9JhCeyH02pJwNZ9H0Odaj7WxNd6lNHmsV1mxNYfG2+99/RNXyWlWXtf6CQAotzl+F33P+9LZSr24rV14yHXrpTdaVuFs9F2no9my/FFNq/NX6V4zF+Zhf6GgOb3vdoqx3c8bfItvsYjf/JPoAt4u2/8v9Int76YE7quHSfy2MbLBAd3jbVlqg7tJVBJIIEHgm0WtVdmzk+Zal9SlGLFOspVYfs3Ln25rWslwqXabRkXenVWFH9ZSU4Nc7XLG2eJ6shtnE/CKClfQu7rGwVridxd3RTq5c5Cn5+I7SdvLT98p2HKX/a11/bnL8LUFPhuQXR1vO3L7EwisCz/mBw+vB/PeQikCfCRB4Zjmh3v17ltU3667VD09+zGezpnv+OPdO2/o5oZVd/hk3r/i7j72S7Lq+Z+zd/e/vsZtrKJwBIHbxlgUb2tQyT14yNHyYex+zO07uzvjnlWyn0ZIPvzrWTs7e55lpJDtOuuQXRw7CLRqy+8JqVyxbC/hk7ltXVtBbzhW043S7Q4HcBp4djiN/2avlF1qnEmzBs9LtLrWpsFU1yTd752tppYaGNmjVyBPmuzOjtPhbQ0r+1oz6lGW18YM7NxT9Bp9Gj0u+OG8CM+5OG3LcwFMactkG8ZopztZjlZL1tbHA42ZGwXnY5oplroAv3T43afBuez94Yx7MERN4ZjXvTidmVfU89Xot3XuF7cb62Tz3xU8KP9vZcD/QaOU58SvpUslGIQ/On4mvM8Mb+Ga87Rpu87+xrmdctm94M0PFeZ0tbbWlu3PO0gKWwzPBIayd19vvJZy/rd+H2Hp8zQ+QrbPNzeE8hynMNcn5bV4EspigI0b+wcKgx2RRdWSdZ589o2F3oN2f/pdsnP+yxipvtLozXlz8QMwp2y2AWYzcLbBbslV7PuaLdKt6B/F+t0CwlIbH0Exx3hhLCR6TwWqhLZ7DPmzhnw7ZWLcRSHJs7TaVFTQhPD5idN0tiVGIIj0UKPWw7eI13W6Ph9yT282aar7vTv5d02651Zl+8On9v2u0/GmrO8Mlye5yF//40AxHtGDVvrnrccEskXeWFHYvR96d+I6G84nr6FYFm4a2t6biv5Y5l/Gb/lD8Q0hsYF1dGqVkb+KNUnSQvWk43BfWrg6pEI15V8RDhdKldbFf07I9RjvdUVKbCcR/sbbCLJECz4q8J+s7zpu8WRs3jlgzSX5G0IrPs4STI1fL35znnpSS/J9jV+R8+NWj2MV7U9DdN3a73md7TFiSrbGxBxWzYEnRp/BpXeUmzWzK9k1/Rju07kZOcjRcCOLjd2aRW+ALc4vvsIrDalexllD3NVbyWsld11drSZdq0C/xg+8kz/9BV+/J+Ak802Y/+pClkktwInQlv1x4xW1qDB1ou/uzOBfjU1Ud+b7bJlUAAAAQAElEQVROVgaPnVL8UyI13N4q0uWoSghGHhK7y670x9hl2ynoC7T7quH2amdIEXlCMPO3iPvSSXaNJL/IlU4f2q2l1EjyS07muDH61FE73RyOY4wfeHr3K9XqD7V1b9Um9+qrdXxyTbtT1L/5GvHOd+vEFs+CPSgyCB4KJpB2d6c37in5Lr7RRAxgzdobVWrudr8lIkeCZLdKl5TX6dh9FieoZNuiDXfVtoltpjglCT7abCTFbI1SeIzEfZP/k3bcK96LdNtDcA9sO2vPM3p7zsXuxN+18yM2xi7dTkGXKDBup4X08ng9LEFlf9D3fxodeJ59RTg8JASf8Zpwfo94BSlVDAF3fcx+EnjGhOtVMQLPtOW938eqzMc3jscnr1Fjepn1J4vdsiO6dfufauzA9J70fjpJMFWgQMlmxE8nOSb15wpfJrNqMlucD4+bzKpPueJdY9fndFvmluHsELE72OWCTkm+FPnnNnpru8jbyDV/ll10xLIkgfH8taaRSh3JBXzzfLyd1+N1f63YJ+6H+M7bo0RiAQLPxIRzKmj0eDf7nO5ozYbr5GfCz2DG/Mbg3Aq3vO0fLr+prlX7h613W94R738/9EcrGLefu2rVfr09xME63/bScOW2826T0aX/5bFt2lD8wwC2rSvblCTBUkN/ybZzVrv3D7W/BVn8g2N31Pl2Du2ZjF1/KDhcin9cdCjPmmMBF17/4/RvibbbIWzwiVOWMj0QIPBMG72kf0i7ysT1TVz+c6lxSOJ65q9gbzUaazVa2XKL4/w5W6WGL0ZJN7TKFnn/TCmcTiry7pzdcXTs/nj/v7HLtl9wX1Uq4YTf7ZfoRc4VK8LehYPjN+2ujF+2zZJOh2q2n20W6FG2FSuWSAk+EDVcO0G8vRYpyWWPJIUpm2OB4U3hPNTxNjyUGkfkeGR0bY4AgecckMQ3GwpfGklcTeoV1NavlfzhqdfbrNDvJucndeT+ezVvJvtTi13cNc9jGrt4lwseGLu97nwDdhft6ntzWrBOYJbcErZ0xH/OOf2yk+Zi5t1RO/w1yS7smM12WGzJLWNWIsGhM66doDLZ2Ta8qtZHlrYECpYpHB/sdXHMXoczucQsSrFuCxB4pi1e8jNpV5lafbWp8+UV3lxSq3KLih6omem1qi5/xBZpnf/r9MPOC91d4vhCbKWrVh5vPU5wChB/iZXPfvHumOwbSdiC889PVEN3th5LjdLLEvWzO4UPS9aMv7Bl+dLQ5ZbH2xp3eWLcgpQrgIDz62P10usJyuRMK+KSgQCBZwaoua5yom5bFP1Tsumju4+9w16WbMunW5egbzvp/o3Do8rnJ92/In5fbKvS+NRN8ct3UNL5p3eQuzdZvTsuUcNOyY45bL/xZAFy++3Eyzl7hornxCvcLOW1feOnzf8W+rN67f9K/gcLZWlx3x4a23e3Fnm4u7gCG2J2fVddVgnfZYhZnGLdFCDw7KZ2XtqqTX3Hdo0fm1F3dtLMzPrYWz7DN/Gdrordt4Z7eeyy3Sv41NhNucYXY5ftvOC9NFp+defFulRitBx2uz4oQWvXqFaP+0bXabM7muUzOy3Utfy3LAlbt3dJ0N41+tb6dr5cFJqIuzs1lJUaw/k+nm9sZFcdVblfW2vIe9gBg/SFqdk5jPpb0nlRd7VMbzRObJmHDLkQIPDMxTT0oBPjU1+3Vl9haxbLUnt3uFQr9433zWjvvhu7U07HaOX+D1ZeL9WRl1jX7mVrzGWouyeadjpZeb04nZSsa76erHyHpZ0+2GGJ7mV3OiFZY/7HbZdvDP1P23nny+iUZMvsfDWml1atvEDe3ahNvr015F00/b30OlDwmlZPXS8X9wum7lgdXtm54AID0X0Cz4GY5ohB1uqftid5VlsId1Zp+HI9eb/Ot0hN6yMRPW4vuTTz8fYy9iKX+/etWu3sRl3j66Y6K5I49/00WvlA4lrSrmDl8sdYlY+3Nf7iXZJdvnHa3VOj5TfHKZhpmeryFVZ/Usu1Vkd7y84PucAyhpPJ21Ws5XBzzOkpqhphq/Z2Nqolba4h722Wl+VuAffZu//t9J+hxvs7LUL+7gsQeHbfPF8tjtc/I7nXKpvLUk0P1bVqpLNToJw3GU6plCTAOkpjyw/JZkgJaq1W3mql4+/OdO4/rXz3F+fforFKvn6StNT4ckIIr9Kibh62MNvdsNUzzoex2dIZ/fVnJKx4k/z02W3XMfvjB2e2nX++jCV34nzJPU0Lu83l4hxj3r5dTwfYrcYbYW9cvMace5Wq5X07LUz+7goQeHbXO5+t1SY/KudDUJRF/+6vhlunTs/z6d1/JOqMb3zJyjtb87E0Azef7NP4oiVhTL0Zj/fn96bheVqtVv7JUhO+ufifaPzSDH5O1nrWatk0dG6rLF27v/lhyCf94YVLtWbDHzvs88c7zL91du9friNG8nXOZO/eZJ3s/GeEhxKdycOa7LNlfOoKG9E1tsZdVsctSLnuCBB4dsc5/62MT31Qzr0ro47ezwLbdTpm2b3brn9i8iuW90+2xl32VLWSdKtY3La3Lef17W0TO0jxOk3f+fGt6spl3kb2ULX8nXnv6WbikeVHST5Z0DLb32/OXvXgr9OjzLL7W1vnDrU6cpBZJvswFOp0/vPhqqN19ktdv+6ozNaZSxpyvfsgtnVfpKMPWWpJb7S1s8Xrr/rbTvG/TKm+vSQ5JOlB9vyq9a1MHwyMwLMPJjG1IYxP/qu9EWV1PN8/aGPpko4O/vYu4SEA/tkaG3lLaj5xKxor264j/+i4xZvlhjfZ3DT/6+WfozRa/mzPOhC+ODCjNI7L3KRNi3v9oeR5Gqt8smeWzd39biKF9u/QgVPxdpt7l/DLYXqiwpd5UhhE4iruvP3TVkfne1hKOl8XXjhtZVm2FKjVw+Eff98yqcP/R+2xETZedFgsR9n7uCsEnn08ubGGVpt6m5xOj1W2daFHaJFfq6Mq7f3SzOxWz+tbV7tADu8+oNFKwgB2gfpb3VWt/Ke8nt4q24L3O52i8KseC2bq0p1OL1a13P2theGUM8O6zEa5q63JFu++qvMv/UOySlIo7f0rzfILKdTUWRWHV3bXTCmcvzRspeus7Nzc3p2lk9VQnEt4fjv/hzhF7ynjz9SqkeX33O7Bf6Mjx1urx9na+eJ99+e/8172poRLfNaKZ9vz64exz67Sm1EPRKsEngMxzR0OcrweTq0SPnF2WLCN7F4P0yb/E409NHybs3WBkk9+4m3nT9No+cOtG0sxR6WyyF70vmFbkF+SsNY/a7ze+622Ww/iqTa2uma/Wb71PVncGls+okXTFij5pMci3tW7xql3/ZOHq+PN8rLY573tdAThS3fDfr28+3+dFp03f2PmvfOmt5vYUPLzxDbcD23Pxj7tNplqvrGRf5RzcYPH36s21fvDV1IFSbGy8fppVlvSw4ser9LwFRorv8zqYsmJAIFnTiYid92o1V8pr89l1K/95Jde1Fbdq6dCvuS7RZ1eZ2/wFvB24dvZq0aeoF39LyQ9zdZkS+9+PWiTnL5nnf+jrfMtIyo1fqrml1PmuzultLC12jfqVltnZ0awAhHLGk1MhZ9tjLg7k+RNkgvH+EbtOtxfavxCYazK8BJO5eQbP7IW4p9ZwQrfs7iv69z1yY5PnJiyD2dK8jO5oTtL5N0Gzf6gQLjdnbVafpq12/pnQqN649ynou4i/S4B5198139JruzxoU/ba9XPbH2BbQFNcB7lJN3oh7LpjIHAMx3H/qxloh621n0tm8G5A1Qtt3eM2caNr5T8X1Lox0Hy/leqVt6msQN3SqG+rasYrTzQ6v6QGi4ch5jG6Ye+qPGpUNfW7XTn1iUarx+lkjt64eb8+1UtX25v+uH8hQtn7eTeauXxVu95ClurOynXKm8j6XHDrRqY9/4fqDZ5jHxjoROfu+ZYq+W6Rpc9Zd5a4iaOlZ9klhfZB4kPxq1i3nKl6aTHaM5W692zZv9J9HfIxjdu43xTolraKXyySpo9t20ImtspMV+eO9VYnNUhTfO1V8y08eYPnaxLp/P+0fY+cqZtAb2uOX/heXbMsva/8JpOJ6jFBAg8DYFlAYFa/Vny+payuay0N4rWxwteeMVt9oIRfh4xjV7YY96/T37Ttbb75YOp7KIbHdlP4VhO56+1fr4hjU5K7jeq1ZMfZqCYF+c3NkuunrxUs1vrtMBlX3vTP0vV8i9VrbxVzVNHLZA76q7wJjA68nSNli3Y9mEr2GFRWWOmf0lrJn8Zs+y8xdpMnN3SObHetnr6Vr/wMyJX+paq5Z+rOvIGHbn/Xm22sXW2cEzsaPmZVs/F9vwNp8I6dOsMSW+5U7X68l8lraVZfmLy99bHf27+n/zPKTbmDWbX4gNTzIaqI8fpksrV9iHhLTFrmC3mdaImLk7jw/Rsff38tzF9ZMrD27U5f+F5trF0g8KHverI1zRWPqn5oS/ssRqtlJuHEq2sPFLhTBpho0LKnRjk6kqDPHjG3qbARP2pljOrn2p8qj3hv271L7zU1q+1N6dw7OnC+dq/975W35vlnb3Bl9eqWvmo9eO5qi7bUytWDCvqUqksagYD4du01fKnFLb2Obde8mHrcPi1kqiSnaRP227sx3dSIPW8XovurnPozhfd/f/C/zzCHN4v7682lx+b58fs+oXN4H72C2WuWTxsMQq3w0+qjlWOsXwftHzf0MbS9XK2+9bpCc186f65RUv3fmG6VbZd2z3ndmzMtHv4xT6S+5BmZq4xm4vM6DSNjhyv8Ea4ct97SbrHMtwOwf7YyDMs77/b+m0tmv615ThL0uNsTXv5rW3BTfcE7hP1j0vuq0rn8liFD0vhuVktn9x8virBJQQho+UPm+s1avbRP0SJLvaaM1E/PVEVg1R4zYY/WqC4KqMhL7V6RyR3rLze2/zQF/ZYOT9pr8E/Vcn/QjO6wtp/u7ikJpBy4Jlav6gobwK1+qg9+c7NpFteT1fYYtiq8vBi7X0WpxVabgHTCfbC8yWpdJ2W3HK9mlucypfZ9UV3rRac2laoXf0NzWBAPpxC5hXW5X1tTXkpHaHVU9enXGn86prfqPfP7rCCg83zn63M5xWC+03+NxY8/dosr9EllesVbpeGr7Ug9Rx5hZ+RDAFZ+oc/WAdmF3ekZn8xZ/Zmr/6GN1HplR02f6gZvVbOfaH5RuiGN1te3bQsDd9ojlfLu7Ot3jfaGrb27WjX2Sy+FOYq/bprk+FQhHUpVhyem+9qPl+r5Q0arfyXrSeqWn6efRga02j50OZWrVX7PVwryxWNVp6o0WVPsfterNHyv1i+b9t6lb3uTSocIy7F2/q8zYBcsrNcbFPfACSMT41L7l/EpS8ECDz7Yhq7NIjxqZXW0lpbM1hsi2F15P0tK56Yepfl+bitWS7hF1H2sQb2tzXsogzrcvs/pD3ArrNbvMZUW3dhdg3ErLk29d/yOitm6VBsFyu/u/1jHWJVpAAAEABJREFUb95+N7vexdbuLN59ULXJH3WnsTZamT1HYfxvMzvd+y7LvaV5LJXlxd78J9aF01pl08jGncJz7doMKn+sBZDPtzX8ItoX5d1qCyYvUqnxUzWGrlRJ6+y+C5pbvLz7rN33b9aHEMA/1K7TW7x/vmrrrkyvwgGqqTYZ3h+yOdtKK0avO1tl4f72BUrtZyUnAiZwkztEcj9XJhcXjg98Z8uqa3XbkuZObZmvaBmcjtZEvZbbbk/Uj7O+XW5rcRavcU1MvjV3HV66d9hqeEXu+rVQh5y+odk3/4VyJbvvwgs3qjF9kFXyS1v7awkfgCamvthfg+ryaMLZVuQ+1uVWaS5lgUEIPFMmG/DqJic3aZEOUFbBp/fvtt1cr1arS23yRNvaY2urjIW4/882loM1Xv9u7nu7pLHC+liUgOkCC+SzOjbMGBIsYbf/tDvYarjR1vwv4dRa4/VndKWj4XCExrTtYfD52/IfG8B/NJcfgGKPp4cFa5OvsS3WrTdQ9LCLNL2wAIHnwj7cO5/Adyf/Pht86tfK4uJ0ugWfrU/PU5s6Vc6NWhf+aGtRlx+oNPQY1aYuLsQAvrX+r1rk9pfXL/LdXwtaavW0vxWf7pDPm7xZwzNh614Wu5ZT7KtfbR+KjkpWYYel12z4mz0nnqjwWtBh0dxld3q7jeW1uetXkTs0Mfke637Ya3CzXbMUTIDAs2ATlpvuhuBz2i2z/vyvrekvTmcpfOO5Vc3jk2u0pBG+TX12q6y5u7/5hlRfodVrszHMasBh7v/k9rPqL7A1j8sX7Y3+iXns2DZ9+t7lv9Xi7ZdZIH/pNvflIcHrM2Z5ZM+6En5Fzfljrf0iBhib5NxTLWgPx4vaEFhSFajVz7EPwQ+1vUXFe+1PFaJ4lRF49mjO+qLZsMWmMR12F/4pk/F4f45Gl9tu/Ra1h61wtamwhfRFlrMIuy5/ZC+WBxf6DSkccjG7RbE3B/vbREcsb1Yvz38a0akFk7/z41s1UQ+nPfrSgvm6fqd7rfXr5V1vdm6D4STizj/MkjP6MQurOe3F+XM103i0xiezOgdy2j0uZn3fnfyTwmu/d8+1AfClLUMowkLgWYRZynMf12y4TqWZQ6yLt9ua/uIal2psZJ+2Kq7Vz9TGnR5uQd07LH/+tpA4XWV9e45q9UNVlF3rBrngEg72941jLM/vbe3lUpd3FdXq/97LTiRqu1Y/Xl7Psjqy+SBnFbe5XKIh7aPa5EfbzJ99tvGpm2xunyWng+w5dGFKDaZfjdMN1sfnKZwB5Nz19nxPvwlqnEdgYvIr9vh4pD1/Xmz3brCVJccCBJ45npzCdC38gklpJux2vzWTPnv9UIdXdm+r7vCt2NrUe+W328veoMKXj37bVrlMM/nLZt+M6g9XbSqtk2Rn2uOOKp9Y/+3mLi/nw3FXMx2VTZ75T/L+VarVK5qYrCevrsc1TNS/pmn3UHu8nGI98bZ2cXG/scZeZJYH6fv1fB7DO16/RLWpJ0olW5Wfb4h7mZd/qW7faW+N179sjnlbXN46lEl/JuqfV62+nz1/DrP1I9ZGrz/EWRdY5goQeM4VSXy7eV69hLW4hL+MEbP5JMWawacLWz43Jqlm/rLuPhr212vlsrBbf/4sc1MnLv6LalOnaunGvRSOs/LuC5alm1tBr7V2P6WS/0frx4E5fTMykpSWcNzn+NQ7LWjay7Y6hGPasg74LzHff5JbtLcmpj6lfrqEQ1jG62+RGvbYVQhAb8p4eD+y+l+hpbfvrbDXwG7kfgnnug2HVHg9TN6Fk+af34M+h9eTM639J2uibluIpz6rCy+czqwfXvdW/MsDdOutgxF8BqPx+gX2mvs6Nab3lNyh9uH0X+3667bG+5lXp3BuZ3FJR4DAMx3He2rx+pzkPyqv02Ktoaz8qSriZfXkT63bBzbH7fSR5nVch7nlwk/VDZUebfV3tpx9xZ3N46wmJl+goU0PUfNYIPcxyV2n1C/u53J6n61H2xu4bfmYfJVWT12UejN5rvC8yRvsTfjtcrfsbS/2zzeLb1h377Q1jcV257tT5TVmvgfZvH5S45fekkbFuayjtv7X9ub5Fi3efm/JvVDSd2ydsTWN5Uabm1PUKK00y0Nt/bTCcyWNmrtZx0T9atvS/SHr/+FyPrw+hF8TC8fK2mMlk45cq3AeSafjmq8ntfqLrP3vK8VLZFXD7gc2Z2+X3Ns6Wr1OsufMCTpqMq3HjgpzaZ4dYfJHCj88Ups8VrXJRzQfJ05H2/v0SzX7oeXdNp4Pm+3n7frM5rXT57e4Pt3y5nErtnW3mAuBZ9rzFn7hpTYVDsp/vSbqna+h7Owvm6Tds+7UV6tvaI57vP665nUcg/nKhJ/TG69/JtEgwk8/No8FmnyNvQDtpZnGwxVOxxRemKUzrO5v2gvMhZILn4r/T9LttobdnQ27/pvd9xe7vsLWC+z/8E3KT9j/b5bXE2xL3x5W52MsUDjJ1u9a+mAv41ffoXCy7HDux9LQHvLuSQbybrsOW57PVzgWToraOh6Cybrkvi0p/ErVK23L8f629XpPMz5RE/X8nmTfOpz6Er58VJv8LwuunqIZv7sF9EfIK2xVDgGWPRZ1o7V5h61zl4Yl3GzrpIKl0+ny7mW2VrR074fY4/QtWrPuXPXLZXzqCjP6tK3H6ya3h8Jxqs6vsufqO+Tcp2yY4ctJ59v419v/4UwS4dCgTfZ/eI5P23W4fZNmz1F8vqSvmfUnLVB5q9Vhga17qNW9tz0GX2N2Zym8nlimri3h8Ifx+r9Z+x/oaJ2ov8+eM6frZIXHgwb+Eh4n4/XvqmZbqCcmw4eWk1Wrv8Hm9MV2/aLm9Xj9xVtcn6DaVPjQN/B0aQEQeKYlST0ZCWRY7bnrr7KtZmvsRfl9qtVfaevTFY4fC5+KF7nd5LfbTY2hPeSm99CSxm5aVHqwavVH23qYwjcpa/VXK3yZZaL+Q51nW/oy7Gqhqw6ni5qY/B+zOtm2Dr3Arg+3F/U9tcg9uBkcqHGAGo1DVGqMqOT3tC18u1meir25HmPX/2zrGbbleF0ht8ilPXHnTv1OE1PnaaL+dnM53tbDbN3DgqMH2/po+dKBkj9YwbIxtKc2bgyWy5uW4/UTzP8/ba0rnMA+7b7lqb5w1oVmoDY1rnDM97jtfajVn6Va/XAb/4gFprvb4+xBKg3tbh8a97SA3gwX7aaNO+1uVo9p5gv5J6b+SeNTH1Rt6nx7rbgmT0OkLwgUVYDAs6gzR7+zFQjHLE5c/BetWXujxjf8Rt9a/1eFtGxbHaTavXn+qfklltr6tVqz/idavX69BZjXK2zhGySJ5GP1FhzdZOsVCr+jHs6YECzDY/fCK25LXn0f1hAC0/A4Cx+KwofGENCHwzYuvDBqK3wfInQwJLIikKIAgWeKmFSFAAIIIIAAAgggEC1A4Bltwz0IRAmQjgACCCCAAAIxBAg8Y6BRBAEEEEAAAQR6KUDbRRUg8CzqzNFvBBBAAAEEEECgYAIEngWbMLqLQJQA6QgggAACCORdgMAz7zNE/xBAAAEEEECgCAL0sQ0BAs82kMiCAAIIIIAAAgggkFyAwDO5ITUggECUAOkIIIAAAghsIUDguQUG/yKAAAIIIIAAAv0kkLexEHjmbUboDwIIIIAAAggg0KcCBJ59OrEMCwEEogRIRwABBBDolQCBZ6/kaRcBBBBAAAEEEBgwgWbgOWBjZrgIIIAAAggggAACPRAg8OwBOk0igAACcwS4iQACCAyEAIHnQEwzg0QAAQQQQAABBHovkN/As/c29AABBBBAAAEEEEAgRQECzxQxqQqBnAncJ35/3M7xy/ZZyemZpK+TOxVVhH4jgAACaQskfUFNuz/UhwAC6QncYFXdGm/1v7dyLE2B7abtKqajQrk/WHkWBBBAAAETIPA0hPYXciJQEIGzr7hTtfrDbN0p3jp1ZEFGmn0316y9MZ5hfbP907LvJC0ggAACxRAg8CzGPNFLBBBAAIEgwIoAAoUWIPAs9PTReQQQQAABBBBAoDgCBJ7FmauonpKOAAIIIIAAAggUQoDAsxDTRCcRQAABBPIrQM8QQKBdAQLPdqXIhwACCCCAAAIIIJBIgMAzER+FowRIRwABBBBAAAEE5goQeM4V4TYCCCCAAALFF2AECORSgMAzl9NCpxBAAAEEEEAAgf4TIPDsvzllRFECpCOAAAIIIIBATwUIPHvKT+MIIIAAAggMjgAjRYDAk8cAAggggAACCCCAQFcECDy7wkwjCEQJkI4AAggggMDgCBB4Ds5cM1IEEEAAAQQQmCvA7a4KEHh2lZvGEEAAAQQQQACBwRUg8BzcuWfkCEQJkI4AAggggEAmAgSembBSKQIIIIAAAgggEFegf8sRePbv3DIyBBBAAAEEEEAgVwIEnrmaDjqDAAJRAqQjgAACCBRfgMCz+HPICBBAAAEEEEAAgawFUqmfwDMVRipBAAEEEEAAAQQQaCVA4NlKiPsRQACBKAHSEUAAAQQ6EiDw7IiLzAgggAACCCCAAAJxBdIOPOP2g3IIIIAAAggggAACfS5A4NnnE8zwEEBg0AQYLwIIIJBfAQLP/M4NPUMAAQQQQAABBPpKYCACz76aMQaDAAIIIIAAAggUVIDAs6ATR7cRQACBAgnQVQQQQKApQODZZOAPAggggAACCCCAQNYCBJ5ZC0fVTzoCCCCAAAIIIDBgAgSeAzbhDBcBBBBAYFaAvwgg0H0BAs/um9MiAggggAACCCAwkAIEngM57VGDJh0BBBBAAAEEEMhOgMAzO1tqRgABBBBAoDMBciPQ5wIEnn0+wQwPAQQQQAABBBDIiwCBZ15mgn5ECZCOAAIIIIAAAn0iQODZJxPJMBBAAAEEEMhGgFoRSE+AwDM9S2pCAAEEEEAAAQQQWECAwHMBHO5CIEqAdAQQQAABBBDoXIDAs3MzSiCAAAIIIIBAbwVovaACBJ4FnTi6jQACCCCAAAIIFE2AwLNoM0Z/EYgSIB0BBBBAAIGcCxB45nyC6B4CCCCAAAIIFEOAXrYWIPBsbUQOBBBAAAEEEEAAgRQECDxTQKQKBBCIEiAdAQQQQACBewQIPO+x4D8EEEAAAQQQQKC/BHI2GgLPnE0I3UEAAQQQQAABBPpVgMCzX2eWcSGAQJQA6QgggAACPRIg8OwRPM0igAACCCCAAAKDJjAbeA7aqBkvAggggAACCCCAQNcFCDy7Tk6DCCCAwLYCpCCAAAKDIEDgOQizzBgRQAABBBBAAIEcCOQ48MyBDl1AAAEEEEAAAQQQSE2AwDM1SipCAAEE+kyA4SCAAAIpCxB4pgxKdQgggAACCCCAAALzCxB4zu8SlUo6AggggAACCCCAQEwBAs+YcBRDAAEEEOiFAG0igECRBQg8izx79B0BBBBAAAEEECiQAIFngSYrqqukI4AAAggggAACRRAg8CzCLNFHBBBAAIE8C9A3BEqP8jUAAAfeSURBVBBoU4DAs00osiGAAAIIIIAAAggkEyDwTOZH6SgB0hFAAAEEEEAAgTkCBJ5zQLiJAAIIIIBAPwgwBgTyKEDgmcdZoU8IIIAAAggggEAfChB49uGkMqQoAdIRQAABBBBAoJcCBJ691KdtBBBAAAEEBkmAsQ68AIHnwD8EAEAAAQQQQAABBLojQODZHWdaQSBKgHQEEEAAAQQGRoDAc2CmmoEigAACCCCAwLYCpHRTgMCzm9q0hQACCCCAAAIIDLAAgecATz5DRyBKgHQEEEAAAQSyECDwzEKVOhFAAAEEEEAAgfgCfVuSwLNvp5aBIYAAAggggAAC+RIg8MzXfNAbBBCIEiAdAQQQQKDwAgSehZ9CBoAAAggggAACCGQvkEYLBJ5pKFIHAggggAACCCCAQEsBAs+WRGRAAAEEogRIRwABBBDoRIDAsxMt8iKAAAIIIIAAAgjEFkg98IzdEwoigAACCCCAAAII9LUAgWdfTy+DQwCBARRgyAgggEBuBQg8czs1dAwBBBBAAAEEEOgvgcEIPPtrzhgNAggggAACCCBQSAECz0JOG51GAAEEiiVAbxFAAIEgQOAZFFgRQAABBBBAAAEEMhcg8MycOKoB0hFAAAEEEEAAgcESIPAcrPlmtAgggAACmwW4RgCBrgsQeHadnAYRQAABBBBAAIHBFCDwHMx5jxo16QgggAACCCCAQGYCBJ6Z0VIxAggggAACnQqQH4H+FiDw7O/5ZXQIIIAAAggggEBuBAg8czMVdCRKgHQEEEAAAQQQ6A8BAs/+mEdGgQACCCCAQFYC1ItAagIEnqlRUhECCCCAAAIIIIDAQgIEngvpcB8CUQKkI4AAAggggEDHAgSeHZNRAAEEEEAAAQR6LUD7xRQg8CzmvNFrBBBAAAEEEECgcAIEnoWbMjqMQJQA6QgggAACCORbgMAz3/ND7xBAAAEEEECgKAL0s6UAgWdLIjIggAACCCCAAAIIpCFA4JmGInUggECUAOkIIIAAAgjcLUDgeTcF/yCAAAIIIIAAAv0mkK/xEHjmaz7oDQIIIIAAAggg0LcCBJ59O7UMDAEEogRIRwABBBDojQCBZ2/caRUBBBBAAAEEEBg4gbsCz4EbNwNGAAEEEEAAAQQQ6LIAgWeXwWkOAQQQmFeARAQQQGAABAg8B2CSGSICCCCAAAIIIJAHgTwHnnnwoQ8IIIAAAggggAACKQkQeKYESTUIIIBA/wkwIgQQQCBdAQLPdD2pDQEEEEAAAQQQQCBCgMAzAiYqmXQEEEAAAQQQQACBeAIEnvHcKIUAAggg0BsBWkUAgQILEHgWePLoOgIIIIAAAgggUCQBAs8izVZUX0lHAAEEEEAAAQQKIEDgWYBJoosIIIAAAvkWoHcIINCeAIFne07kQgABBBBAAAEEEEgoQOCZEJDiUQKkI4AAAggggAACWwsQeG7twS0EEEAAAQT6Q4BRIJBDAQLPHE4KXUIAAQQQQAABBPpRgMCzH2eVMUUJkI4AAggggAACPRQg8OwhPk0jgAACCCAwWAKMdtAFCDwH/RHA+BFAAAEEEEAAgS4JEHh2CZpmEIgSIB0BBBBAAIFBESDwHJSZZpwIIIAAAgggMJ8AaV0UIPDsIjZNIYAAAggggAACgyxA4DnIs8/YEYgSIB0BBBBAAIEMBAg8M0ClSgQQQAABBBBAIIlAv5Yl8OzXmWVcCCCAAAIIIIBAzgQIPHM2IXQHAQSiBEhHAAEEECi6AIFn0WeQ/iOAAAIIIIAAAt0QSKENAs8UEKkCAQQQQAABBBBAoLUAgWdrI3IggAACUQKkI4AAAgh0IEDg2QEWWRFAAAEEEEAAAQTiC6QfeMbvCyURQAABBBBAAAEE+liAwLOPJ5ehIYDAYAowagQQQCCvAgSeeZ0Z+oUAAggggAACCPSZwIAEnn02awwHAQQQQAABBBAooACBZwEnjS4jgAAChROgwwgggIAJEHgaAgsCCCCAAAIIIIBA9gIEntkbR7VAOgIIIIAAAgggMFACBJ4DNd0MFgEEEEDgHgH+QwCBbgsQeHZbnPYQQAABBBBAAIEBFSDwHNCJjxo26QgggAACCCCAQFYCBJ5ZyVIvAggggAACnQtQAoG+FiDw7OvpZXAIIIAAAggggEB+BAg88zMX9CRKgHQEEEAAAQQQ6AsBAs++mEYGgQACCCCAQHYC1IxAWgIEnmlJUg8CCCCAAAIIIIDAggIEngvycCcCUQKkI4AAAggggECnAgSenYqRHwEEEEAAAQR6L0APCilA4FnIaaPTCCCAAAIIIIBA8QQIPIs3Z/QYgSgB0hFAAAEEEMi1AIFnrqeHziGAAAIIIIBAcQToaSsBAs9WQtyPAAIIIIAAAgggkIoAgWcqjFSCAAJRAqQjgAACCCCwWYDAc7ME1wgggAACCCCAQP8J5GpEBJ65mg46gwACCCCAAAII9K8AgWf/zi0jQwCBKAHSEUAAAQR6IkDg2RN2GkUAAQQQQAABBAZPYHPgOXgjZ8QIIIAAAggggAACXRUg8OwqN40hgAACUQKkI4AAAv0vQODZ/3PMCBFAAAEEEEAAgVwI5DrwzIUQnUAAAQQQQAABBBBIRYDAMxVGKkEAAQT6UoBBIYAAAqkKEHimykllCCCAAAIIIIAAAlECBJ5RMlHppCOAAAIIIIAAAgjEEvj/AAAA//95h9C7AAAABklEQVQDAAJY843SXJEOAAAAAElFTkSuQmCC";

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

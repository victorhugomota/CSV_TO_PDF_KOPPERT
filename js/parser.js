/**
 * Parser de CSV e Normalizador de Sensores Koppert
 */

export class SensorDataParser {
  static SENSOR_TYPES = {
    TEMPERATURE: {
      type: 'temperature',
      group: 'Temperatura',
      unit: '°C',
      colorFamily: ['#ef4444', '#f97316', '#fb923c', '#dc2626', '#b91c1c', '#ea580c', '#c2410c']
    },
    HUMIDITY: {
      type: 'humidity',
      group: 'Umidade',
      unit: '%',
      colorFamily: ['#3b82f6', '#06b6d4', '#0284c7', '#2563eb', '#60a5fa', '#38bdf8', '#0ea5e9']
    },
    CO2: {
      type: 'co2',
      group: 'Dióxido de Carbono (CO2)',
      unit: 'PPM',
      colorFamily: ['#8b5cf6', '#a855f7', '#d946ef', '#7c3aed', '#9333ea', '#c026d3', '#4f46e5']
    },
    PRESSURE: {
      type: 'pressure',
      group: 'Pressão',
      unit: 'Pa',
      colorFamily: ['#10b981', '#059669', '#14b8a6', '#0d9488', '#047857', '#0f766e', '#84cc16']
    },
    OTHER: {
      type: 'other',
      group: 'Outros Sensores',
      unit: '',
      colorFamily: ['#64748b', '#475569', '#94a3b8', '#334155', '#6b7280']
    }
  };

  /**
   * Identifica o tipo do sensor pelo nome da coluna
   */
  static identifySensorType(columnName) {
    const nameLower = columnName.toLowerCase();
    
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

  /**
   * Normaliza o valor numérico considerando fatores de escala de 10^6
   * Ex: 21700000 -> 21.7 (°C), 71600000 -> 71.6 (%), 350000000 -> 350 (PPM)
   * Floats normais como 23.100000 continuam 23.1
   */
  static normalizeValue(rawValue, sensorType, scaleMode = 'auto') {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    let strVal = String(rawValue).trim().replace(',', '.');
    // Remove aspas se houver
    strVal = strVal.replace(/^["']|["']$/g, '');
    
    if (strVal === '' || strVal === 'null' || strVal === 'NaN') {
      return null;
    }

    const num = parseFloat(strVal);
    if (isNaN(num)) return null;

    if (scaleMode === '1e6') {
      return num / 1000000;
    }
    if (scaleMode === '1e3') {
      return num / 1000;
    }
    if (scaleMode === 'raw') {
      return num;
    }

    // Modo 'auto':
    // Se o valor for um número muito alto sem casas decimais significativas ou em micro-unidades
    // Ex: 21700000 para temp (seria 21.7 milhões de graus), 71600000 para umid, 350000000 para co2
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

  /**
   * Converte string de data/hora em timestamp milissegundos
   */
  static parseDateTime(dateStr) {
    if (!dateStr) return null;
    const clean = String(dateStr).trim().replace(/^["']|["']$/g, '');
    
    // Tenta Date.parse padrão (suporta ISO 8601 como 2026-08-20T09:10:41-03:00)
    const timestamp = Date.parse(clean);
    if (!isNaN(timestamp)) {
      return timestamp;
    }

    // Suporte a formatos brasileiros DD/MM/YYYY HH:mm:ss
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

  /**
   * Detecta o delimitador do CSV (vírgula, ponto e vírgula ou tab)
   */
  static detectDelimiter(csvText) {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;

    if (semicolons > commas && semicolons > tabs) return ';';
    if (tabs > commas && tabs > semicolons) return '\t';
    return ',';
  }

  /**
   * Divide uma linha de CSV respeitando campos entre aspas
   */
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

  /**
   * Paleta vibrante com cores exclusivas para até 40 sensores
   */
  static generatePalette(count) {
    const curatedColors = [
      '#007a3d', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#ec4899', '#10b981', '#f97316', '#6366f1',
      '#14b8a6', '#e11d48', '#84cc16', '#a855f7', '#0284c7',
      '#d97706', '#059669', '#7c3aed', '#db2777', '#2563eb',
      '#65a30d', '#c026d3', '#0891b2', '#ea580c', '#4f46e5',
      '#16a34a', '#9333ea', '#eab308', '#0284c7', '#be123c'
    ];

    if (count <= curatedColors.length) {
      return curatedColors.slice(0, count);
    }

    const colors = [...curatedColors];
    for (let i = curatedColors.length; i < count; i++) {
      const hue = (i * 137.508) % 360; // Golden ratio hue distribution
      colors.push(`hsl(${hue.toFixed(1)}, 75%, 45%)`);
    }
    return colors;
  }

  /**
   * Faz o parse completo do CSV
   */
  static parse(csvText, options = {}) {
    const cleanText = (csvText || '').replace(/^\uFEFF/, '');
    const scaleMode = options.scaleMode || 'auto';
    const delimiter = options.delimiter || this.detectDelimiter(cleanText);

    const lines = cleanText.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('O arquivo CSV deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
    }

    const headers = this.splitCSVLine(lines[0], delimiter).map(h => h.replace(/^["']|["']$/g, ''));
    
    // Identificar coluna de tempo
    let timeColIndex = headers.findIndex(h => {
      const lower = h.toLowerCase();
      return lower === 'time' || lower === 'data' || lower === 'date' || lower === 'timestamp' || lower === 'datetime' || lower === 'hora';
    });

    if (timeColIndex === -1) {
      timeColIndex = 0; // Assume a primeira se não encontrar
    }

    // Identificar colunas de sensores
    const sensors = [];
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      if (colIdx === timeColIndex) continue;
      const headerName = headers[colIdx];
      const lower = headerName.toLowerCase();
      
      // Pular coluna de eventos pura se for não numérica
      if (lower === 'event' || lower === 'evento') continue;

      const sensorType = this.identifySensorType(headerName);
      sensors.push({
        id: `sensor_${colIdx}`,
        columnIndex: colIdx,
        name: headerName,
        type: sensorType.type,
        group: sensorType.group,
        unit: sensorType.unit,
        color: '#007a3d', // Será atribuído após contagem
        enabled: true,
        data: []
      });
    }

    // Atribuir cores distintas
    const colors = this.generatePalette(sensors.length);
    sensors.forEach((sensor, i) => {
      sensor.color = colors[i];
    });

    const timestamps = [];
    const events = [];
    let eventColIndex = headers.findIndex(h => h.toLowerCase() === 'event' || h.toLowerCase() === 'evento');

    for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
      const row = this.splitCSVLine(lines[lineIdx], delimiter);
      if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

      const rawTime = row[timeColIndex];
      const parsedTime = this.parseDateTime(rawTime);
      
      // Se não for possível parsear como data, usa índice como fallback
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
        const val = this.normalizeValue(rawVal, { type: sensor.type }, scaleMode);
        sensor.data.push([timeVal, val]);
      });
    }

    // Calcular estatísticas básicas para cada sensor (min, max, avg, count)
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

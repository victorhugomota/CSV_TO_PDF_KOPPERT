/**
 * Gerenciador do Gráfico Interativo com Apache ECharts
 */

export class SensorChartManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.chart = null;
    this.dataset = null;
    this.axisMode = 'single'; // 'single' (como no print) ou 'multi' (eixos separados)
    this.initECharts();
  }

  initECharts() {
    if (typeof echarts === 'undefined') {
      console.error('Apache ECharts library not loaded!');
      return;
    }
    this.chart = echarts.init(this.container, null, {
      renderer: 'canvas',
      useDirtyRect: true
    });

    window.addEventListener('resize', () => {
      if (this.chart) this.chart.resize();
    });
  }

  setDataset(parsedData) {
    this.dataset = parsedData;
    this.render();
  }

  setAxisMode(mode) {
    this.axisMode = mode;
    this.render();
  }

  formatYValue(val, unit) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    if (Math.abs(val) >= 1000) {
      return (val / 1000).toFixed(1).replace('.0', '') + 'K';
    }
    return Number(val.toFixed(2)).toString();
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
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridLineColor = isDark ? '#334155' : '#e2e8f0';

    const activeSensors = this.dataset.sensors.filter(s => s.enabled);

    // Configuração de Séries
    const series = activeSensors.map(sensor => {
      return {
        name: sensor.name,
        type: 'line',
        showSymbol: false,
        smooth: false,
        sampling: 'lttb',
        data: sensor.data,
        lineStyle: {
          width: 1.5,
          color: sensor.color
        },
        itemStyle: {
          color: sensor.color
        }
      };
    });

    const option = {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        top: 35,
        left: 55,
        right: 25,
        bottom: 80,
        containLabel: false
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#94a3b8',
            type: 'dashed'
          }
        },
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#475569' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#f8fafc' : '#1e293b',
          fontSize: 12
        },
        formatter: (params) => {
          if (!params || !params.length) return '';
          const time = params[0].value[0];
          let header = `<div style="font-weight:700;margin-bottom:4px;border-bottom:1px solid #cbd5e1;padding-bottom:2px;">${this.formatDate(time)}</div>`;
          let rows = params.map(p => {
            const sensor = this.dataset.sensors.find(s => s.name === p.seriesName);
            const unit = sensor ? sensor.unit : '';
            const val = p.value[1] !== null && p.value[1] !== undefined ? Number(p.value[1].toFixed(2)) : 'N/A';
            return `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px;"></span>${p.seriesName}:</span>
              <strong style="color:${p.color}">${val} ${unit}</strong>
            </div>`;
          }).join('');
          return header + rows;
        }
      },
      toolbox: {
        right: 25,
        top: 0,
        feature: {
          dataZoom: {
            yAxisIndex: 'none',
            title: { zoom: 'Zoom por Área', back: 'Restaurar Zoom' }
          },
          restore: { title: 'Resetar' },
          saveAsImage: {
            title: 'Salvar PNG',
            pixelRatio: 2
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
      // Barra de navegação / dataZoom inferior idêntica ao print de referência
      dataZoom: [
        {
          type: 'slider',
          show: true,
          xAxisIndex: [0],
          bottom: 10,
          height: 36,
          borderColor: gridLineColor,
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
          fillerColor: 'rgba(0, 122, 61, 0.18)',
          handleStyle: {
            color: '#007a3d',
            borderColor: '#ffffff',
            borderWidth: 1,
            shadowBlur: 2,
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

  toggleGroup(groupName, enabled) {
    if (!this.dataset) return;
    this.dataset.sensors.forEach(s => {
      if (s.group === groupName) {
        s.enabled = enabled;
      }
    });
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

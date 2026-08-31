/**
 * Gerador e Designer de Relatórios Corporativos em PDF (jsPDF)
 */

export class PDFExportService {
  constructor() {
    this.defaultLogo = null;
    this.createDefaultLogo();
  }

  createDefaultLogo() {
    // Cria um SVG/Canvas de logo padrão Koppert estilizado
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    
    // Fundo
    ctx.fillStyle = '#007a3d';
    ctx.beginPath();
    ctx.roundRect(0, 0, 240, 80, 12);
    ctx.fill();

    // Texto KOPPERT
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KOPPERT', 120, 36);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText('BIOLOGICAL SYSTEMS', 120, 60);

    this.defaultLogo = canvas.toDataURL('image/png');
  }

  /**
   * Gera e faz o download do arquivo PDF corporativo
   */
  async generatePDF(chartManager, dataset, options = {}) {
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      throw new Error('Biblioteca jsPDF não carregada.');
    }

    const { jsPDF } = window.jspdf || window;

    // Configurações do layout
    const orientation = options.orientation || 'landscape'; // 'landscape' ou 'portrait'
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Margens em mm
    const marginTop = options.marginTop !== undefined ? Number(options.marginTop) : 12;
    const marginBottom = options.marginBottom !== undefined ? Number(options.marginBottom) : 12;
    const marginLeft = options.marginLeft !== undefined ? Number(options.marginLeft) : 15;
    const marginRight = options.marginRight !== undefined ? Number(options.marginRight) : 15;

    const printableWidth = pageWidth - marginLeft - marginRight;
    let currentY = marginTop;

    // 1. CABEÇALHO CORPORATIVO
    const logoImg = options.logoBase64 || this.defaultLogo;
    const logoWidth = 36;
    const logoHeight = 12;

    if (logoImg && options.showLogo !== false) {
      try {
        doc.addImage(logoImg, 'PNG', marginLeft, currentY, logoWidth, logoHeight);
      } catch (err) {
        console.warn('Erro ao inserir logo no PDF:', err);
      }
    }

    // Título e Subtítulo
    const headerTitle = options.title || 'RELATÓRIO DE MONITORAMENTO E TELEMETRIA';
    const headerSubtitle = options.subtitle || 'Koppert Biological Systems - Análise Gráfica de Sensores';
    const companyText = options.companyName || 'Koppert';
    
    const textStartX = (logoImg && options.showLogo !== false) ? marginLeft + logoWidth + 8 : marginLeft;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 122, 61); // Verde Koppert
    doc.text(headerTitle, textStartX, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(headerSubtitle, textStartX, currentY + 10);

    // Data e Metadados do lado direito
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emissão: ${dateFormatted}`, pageWidth - marginRight, currentY + 4, { align: 'right' });
    if (options.filename) {
      doc.text(`Arquivo: ${options.filename}`, pageWidth - marginRight, currentY + 9, { align: 'right' });
    }

    currentY += 15;

    // Linha divisória verde suave
    doc.setDrawColor(0, 122, 61);
    doc.setLineWidth(0.6);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 4;

    // 2. INFORMAÇÕES DO LOTE / OPERADOR (se preenchido)
    if (options.responsible || options.notes) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginLeft, currentY, printableWidth, 10, 1.5, 1.5, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);

      let infoText = '';
      if (options.responsible) infoText += `Responsável: ${options.responsible}   `;
      if (options.notes) infoText += `Obs: ${options.notes}`;

      doc.text(infoText, marginLeft + 3, currentY + 6.5);
      currentY += 13;
    }

    // 3. GRÁFICO EM ALTA RESOLUÇÃO
    const chartImgData = chartManager.getImageDataURL();
    if (chartImgData) {
      const availableHeight = pageHeight - marginBottom - currentY - (options.showStatsTable !== false ? 38 : 10);
      const chartHeight = options.chartHeight ? Math.min(Number(options.chartHeight), availableHeight) : Math.max(availableHeight, 60);

      // Moldura suave do gráfico
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(marginLeft, currentY, printableWidth, chartHeight);

      doc.addImage(chartImgData, 'PNG', marginLeft + 0.5, currentY + 0.5, printableWidth - 1, chartHeight - 1);
      currentY += chartHeight + 4;
    }

    // 4. TABELA DE RESUMO ESTATÍSTICO DOS SENSORES ATIVOS
    if (options.showStatsTable !== false && dataset && dataset.sensors) {
      const activeSensors = dataset.sensors.filter(s => s.enabled);
      
      if (activeSensors.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 122, 61);
        doc.text('Resumo Estatístico dos Sensores Selecionados', marginLeft, currentY + 3);
        currentY += 5;

        // Cabeçalho da Tabela
        const colW = printableWidth / 5;
        doc.setFillColor(241, 245, 249);
        doc.rect(marginLeft, currentY, printableWidth, 5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);

        doc.text('Sensor', marginLeft + 2, currentY + 3.5);
        doc.text('Unidade', marginLeft + colW + 2, currentY + 3.5);
        doc.text('Mínimo', marginLeft + colW * 2 + 2, currentY + 3.5);
        doc.text('Máximo', marginLeft + colW * 3 + 2, currentY + 3.5);
        doc.text('Média', marginLeft + colW * 4 + 2, currentY + 3.5);
        currentY += 5;

        // Linhas de dados dos sensores
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59);

        // Limita a quantidade de linhas para caber na página
        const maxSensorsToShow = orientation === 'landscape' ? 8 : 12;
        const displaySensors = activeSensors.slice(0, maxSensorsToShow);

        displaySensors.forEach((sensor, idx) => {
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(marginLeft, currentY, printableWidth, 4, 'F');
          }
          
          const sName = sensor.name.length > 32 ? sensor.name.substring(0, 30) + '...' : sensor.name;
          const stats = sensor.stats || { min: 0, max: 0, avg: 0 };
          
          doc.text(sName, marginLeft + 2, currentY + 3);
          doc.text(sensor.unit || '-', marginLeft + colW + 2, currentY + 3);
          doc.text(stats.min.toFixed(2), marginLeft + colW * 2 + 2, currentY + 3);
          doc.text(stats.max.toFixed(2), marginLeft + colW * 3 + 2, currentY + 3);
          doc.text(stats.avg.toFixed(2), marginLeft + colW * 4 + 2, currentY + 3);

          currentY += 4;
        });

        if (activeSensors.length > maxSensorsToShow) {
          doc.setFontSize(6);
          doc.setTextColor(148, 163, 184);
          doc.text(`(+ ${activeSensors.length - maxSensorsToShow} outros sensores monitorados)`, marginLeft + 2, currentY + 3);
          currentY += 4;
        }
      }
    }

    // 5. RODAPÉ CORPORATIVO
    const footerY = pageHeight - (marginBottom / 2);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, footerY - 3, pageWidth - marginRight, footerY - 3);

    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Koppert Biological Systems • Gerador de Relatórios de Telemetria CSV to PDF', marginLeft, footerY);
    doc.text('Página 1 de 1', pageWidth - marginRight, footerY, { align: 'right' });

    // Salvar / Download
    const saveName = options.filename ? `Relatorio_Koppert_${options.filename.replace(/\.csv$/i, '')}.pdf` : `Relatorio_Koppert_${Date.now()}.pdf`;
    doc.save(saveName);
  }
}

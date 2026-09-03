import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Report } from '../store/reportStore';

export const generatePDF = (report: Report) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(13);
  doc.setTextColor(234, 88, 12);
  doc.text('VIVA CERÂMICA', 105, 12, { align: 'center' });
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(15);
  doc.text('CONTROLE ESTATÍSTICO DE DEFEITOS VISUAIS', 105, 19, { align: 'center' });
  
  // Header Info
  doc.setFontSize(10);
  doc.text(`Data: ${report.date}`, 14, 28);
  doc.text(`Turno: ${report.shift}`, 60, 28);
  doc.text(`Linha: ${report.line}`, 100, 28);
  doc.text(`Formato: ${report.format}`, 14, 35);
  doc.text(`Referência: ${report.reference}`, 100, 35);

  // Espessura
  let nextY = 45;
  if (report.thickness.length > 0) {
    doc.text('1. CONTROLE DE ESPESSURA', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'C/V', 'L1', 'L2', 'L3', 'L4']],
      body: report.thickness.map(t => [t.time, t.cv, t.l1, t.l2, t.l3, t.l4]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Empeno
  if (report.warp.length > 0) {
    doc.text('2. EMPENO (E)', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'MAIOR']],
      body: report.warp.map(w => [w.time, w.pc1, w.pc2, w.pc3, w.pc4, w.pc5, w.pc6, w.pc7, Math.max(w.pc1||0, w.pc2||0, w.pc3||0, w.pc4||0, w.pc5||0, w.pc6||0, w.pc7||0)]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Curvatura Central
  if (report.centralCurvature?.length > 0) {
    doc.text('3. CURVATURA CENTRAL (CC)', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'MAIOR']],
      body: report.centralCurvature.map(w => [w.time, w.pc1, w.pc2, w.pc3, w.pc4, w.pc5, w.pc6, w.pc7, Math.max(w.pc1||0, w.pc2||0, w.pc3||0, w.pc4||0, w.pc5||0, w.pc6||0, w.pc7||0)]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Curvatura Lateral
  if (report.lateralCurvature?.length > 0) {
    doc.text('4. CURVATURA LATERAL (CL)', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'MAIOR']],
      body: report.lateralCurvature.map(w => [w.time, w.pc1, w.pc2, w.pc3, w.pc4, w.pc5, w.pc6, w.pc7, Math.max(w.pc1||0, w.pc2||0, w.pc3||0, w.pc4||0, w.pc5||0, w.pc6||0, w.pc7||0)]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Processo (Taratura, Corte, Lascamento)
  if (report.processChecks?.length > 0) {
    doc.text('5. CONTROLE DE PROCESSO', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'Taratura', 'Corte', 'Lascamento']],
      body: report.processChecks.map(p => [p.time, p.taratura || '-', p.corte || '-', p.lascamento || '-']),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Pesagem
  if (report.boxWeights?.length > 0) {
    doc.text('6. PESAGEM DA CAIXA', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'Peso (kg)']],
      body: report.boxWeights.map(w => [w.time, w.weight]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Defeitos
  if (report.defects.length > 0) {
    doc.text('7. REGISTRO DE DEFEITOS', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'Defeito', 'Quantidade', 'Observação']],
      body: report.defects.map(d => [d.time, `${d.defectId} - ${d.name}`, d.quantity, d.observation || '']),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Observações
  if (report.observations.length > 0) {
    doc.text('8. OBSERVAÇÕES', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'Descrição']],
      body: report.observations.map(o => [o.time, o.description]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer Signatures
  if (nextY > 250) {
    doc.addPage();
    nextY = 20;
  }
  
  nextY += 20;
  doc.text('_________________________________', 30, nextY);
  doc.text('_________________________________', 120, nextY);
  nextY += 5;
  doc.text(`Líder: ${report.leaderName}`, 45, nextY);
  doc.text('Encarregado', 140, nextY);

  doc.save(`Relatorio_Defeitos_${report.date}_${report.shift}.pdf`);
};

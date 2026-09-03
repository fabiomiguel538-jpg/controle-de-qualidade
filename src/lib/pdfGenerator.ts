import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Report } from '../store/reportStore';

export const generatePDF = (report: Report) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text('CONTROLE ESTATÍSTICO DE DEFEITOS VISUAIS', 105, 15, { align: 'center' });
  
  // Header Info
  doc.setFontSize(10);
  doc.text(`Data: ${report.date}`, 14, 25);
  doc.text(`Turno: ${report.shift}`, 60, 25);
  doc.text(`Linha: ${report.line}`, 100, 25);
  doc.text(`Formato: ${report.format}`, 14, 32);
  doc.text(`Referência: ${report.reference}`, 100, 32);

  // Espessura
  let nextY = 42;
  if (report.thickness.length > 0) {
    doc.text('1. CONTROLE DE ESPESSURA', 14, nextY);
    (doc as any).autoTable({
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
    (doc as any).autoTable({
      startY: nextY + 3,
      head: [['Hora', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7']],
      body: report.warp.map(w => [w.time, w.pc1, w.pc2, w.pc3, w.pc4, w.pc5, w.pc6, w.pc7]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Defeitos
  if (report.defects.length > 0) {
    doc.text('3. REGISTRO DE DEFEITOS', 14, nextY);
    (doc as any).autoTable({
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
    doc.text('4. OBSERVAÇÕES', 14, nextY);
    (doc as any).autoTable({
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

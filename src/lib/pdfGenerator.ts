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

  let nextY = 45;
  if (report.productChange?.newReference) {
    const pc = report.productChange;
    let changeText = `TROCA: Ref. Nova ${pc.newReference}`;
    if (pc.time) changeText += ` às ${pc.time}`;
    if (pc.newFormat) changeText += ` (Formato: ${pc.newFormat})`;
    doc.setFontSize(9);
    doc.setTextColor(190, 75, 0);
    doc.text(changeText, 14, 41);
    doc.setTextColor(0, 0, 0);
    nextY = 49;
  }

  // Espessura
  if (report.thickness.length > 0) {
    doc.text('1. CONTROLE DE ESPESSURA (3 PEÇAS/HORA)', 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Hora', 'C/V', 'Peça 1 (mm)', 'Peça 2 (mm)', 'Peça 3 (mm)', 'Média (mm)']],
      body: report.thickness.map(t => {
        const getPieceVal = (pc?: number, pc_s?: number[]) => {
          if (pc && pc > 0) return pc;
          if (pc_s && pc_s.some(v => (v || 0) > 0)) {
            const valid = pc_s.filter(v => (v || 0) > 0);
            return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
          }
          return 0;
        };

        let p1 = getPieceVal(t.pc1, t.pc1_s);
        if (p1 === 0 && ((t.l1 || 0) > 0 || (t.l2 || 0) > 0)) {
          const leg = [t.l1, t.l2, t.l3, t.l4].filter((v): v is number => typeof v === 'number' && v > 0);
          if (leg.length > 0) p1 = Math.round((leg.reduce((a, b) => a + b, 0) / leg.length) * 10) / 10;
        }

        const p2 = getPieceVal(t.pc2, t.pc2_s);
        const p3 = getPieceVal(t.pc3, t.pc3_s);

        const activePieces = [p1, p2, p3].filter(v => v > 0);
        const avg = activePieces.length > 0 
          ? (activePieces.reduce((a, b) => a + b, 0) / activePieces.length).toFixed(1) 
          : '-';

        return [
          t.time,
          t.cv || 'A',
          p1 > 0 ? p1.toFixed(1) : '-',
          p2 > 0 ? p2.toFixed(1) : '-',
          p3 > 0 ? p3.toFixed(1) : '-',
          avg
        ];
      }),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' }
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

  // Granel, Caixas Rasgadas, Repasses e Caçamba de Caco
  const losses = report.productionLosses;
  const hasLosses = losses && (
    (losses.granel || 0) > 0 ||
    (losses.caixasRasgadas || 0) > 0 ||
    (losses.repasses || 0) > 0 ||
    (losses.cacambaCaco || 0) > 0 ||
    Boolean(losses.notes?.trim()) ||
    Boolean(losses.entries?.length)
  );

  if (hasLosses && losses) {
    if (nextY > 230) {
      doc.addPage();
      nextY = 20;
    }
    doc.text('9. CONTROLE DE GRANEL, REPASSES E DESCARTES', 14, nextY);
    const body: string[][] = [
      ['Granel', `${losses.granel || 0} ${losses.granelUnit || 'paletes'}`],
      ['Caixas Rasgadas', `${losses.caixasRasgadas || 0} cx`],
      ['Repasses', `${losses.repasses || 0}`],
      ['Caçamba de Caco', `${losses.cacambaCaco || 0} caçamba(s)`]
    ];
    if (losses.notes && losses.notes.trim()) {
      body.push(['Observações Gerais', losses.notes.trim()]);
    }
    autoTable(doc, {
      startY: nextY + 3,
      head: [['Item / Classificação', 'Quantidade Registrada']],
      body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
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

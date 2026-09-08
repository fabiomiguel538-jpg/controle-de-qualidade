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

  // Espessura com medição dos 4 lados de cada peça
  if (report.thickness.length > 0) {
    const getPieceSides = (t: any, pIdx: number): number[] => {
      const col = `pc${pIdx}`;
      const colSides = `${col}_s`;

      if (Array.isArray(t[colSides]) && t[colSides].length >= 4) {
        const arr = t[colSides].map((v: any) => (typeof v === 'number' && !isNaN(v) && v > 0 ? v : 0));
        if (arr.some((v: number) => v > 0)) return arr.slice(0, 4);
      }

      // Peça 1 legada: l1, l2, l3, l4
      if (pIdx === 1) {
        const lArr = [t.l1, t.l2, t.l3, t.l4].map((v: any) => (typeof v === 'number' && !isNaN(v) && v > 0 ? v : 0));
        if (lArr.some((v: number) => v > 0)) return lArr;
      }

      // Valor escalar único legado
      if (typeof t[col] === 'number' && !isNaN(t[col]) && t[col] > 0) {
        return [t[col], 0, 0, 0];
      }

      return [0, 0, 0, 0];
    };

    const getPieceAvg = (sides: number[]): number => {
      const valid = sides.filter(v => v > 0);
      if (valid.length === 0) return 0;
      return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
    };

    // Identificar quantas peças têm medições
    let maxPieceIndex = 3;
    for (let p = 1; p <= 10; p++) {
      const col = `pc${p}`;
      const colSides = `${col}_s`;
      const hasData = report.thickness.some(t => {
        if (typeof t[col] === 'number' && t[col] > 0) return true;
        if (Array.isArray(t[colSides]) && t[colSides].some((v: any) => Number(v) > 0)) return true;
        if (p === 1 && ((t.l1 && t.l1 > 0) || (t.l2 && t.l2 > 0) || (t.l3 && t.l3 > 0) || (t.l4 && t.l4 > 0))) return true;
        return false;
      });
      if (hasData) {
        maxPieceIndex = Math.max(maxPieceIndex, p);
      }
    }
    const configuredPieces = report.piecesToMeasure || 3;
    const totalPieces = Math.max(3, Math.min(configuredPieces, maxPieceIndex));

    doc.text(`1. CONTROLE DE ESPESSURA (${totalPieces} PEÇAS/HORA - MEDIÇÃO DOS 4 LADOS)`, 14, nextY);

    if (totalPieces <= 4) {
      // Tabela única com todas as peças e seus 4 lados
      const headRow1: any[] = [
        { content: 'Hora', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'C/V', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      ];
      const headRow2: any[] = [];

      for (let p = 1; p <= totalPieces; p++) {
        headRow1.push({ content: `Peça ${p} (mm)`, colSpan: 4, styles: { halign: 'center' } });
        headRow2.push('L1', 'L2', 'L3', 'L4');
      }
      headRow1.push({ content: 'Média Geral', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } });

      const body = report.thickness.map(t => {
        const rowVals: string[] = [t.time, t.cv || 'A'];
        const pieceAvgs: number[] = [];

        for (let p = 1; p <= totalPieces; p++) {
          const sides = getPieceSides(t, p);
          const pAvg = getPieceAvg(sides);
          if (pAvg > 0) pieceAvgs.push(pAvg);

          rowVals.push(
            sides[0] > 0 ? sides[0].toFixed(1) : '-',
            sides[1] > 0 ? sides[1].toFixed(1) : '-',
            sides[2] > 0 ? sides[2].toFixed(1) : '-',
            sides[3] > 0 ? sides[3].toFixed(1) : '-'
          );
        }

        const horaAvg = pieceAvgs.length > 0
          ? (pieceAvgs.reduce((a, b) => a + b, 0) / pieceAvgs.length).toFixed(1)
          : '-';
        rowVals.push(horaAvg);

        return rowVals;
      });

      autoTable(doc, {
        startY: nextY + 3,
        head: [headRow1, headRow2],
        body,
        theme: 'grid',
        styles: { fontSize: totalPieces <= 3 ? 7.5 : 6.8, cellPadding: 1, halign: 'center' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold' }
      });
      nextY = (doc as any).lastAutoTable.finalY + 10;
    } else {
      // Se houver mais de 4 peças (ex: 5 a 7), divide em duas partes legíveis
      const part1Pieces = 4;
      const head1Row1: any[] = [
        { content: 'Hora', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'C/V', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      ];
      const head1Row2: any[] = [];
      for (let p = 1; p <= part1Pieces; p++) {
        head1Row1.push({ content: `Peça ${p} (mm)`, colSpan: 4, styles: { halign: 'center' } });
        head1Row2.push('L1', 'L2', 'L3', 'L4');
      }

      const body1 = report.thickness.map(t => {
        const rowVals: string[] = [t.time, t.cv || 'A'];
        for (let p = 1; p <= part1Pieces; p++) {
          const sides = getPieceSides(t, p);
          rowVals.push(
            sides[0] > 0 ? sides[0].toFixed(1) : '-',
            sides[1] > 0 ? sides[1].toFixed(1) : '-',
            sides[2] > 0 ? sides[2].toFixed(1) : '-',
            sides[3] > 0 ? sides[3].toFixed(1) : '-'
          );
        }
        return rowVals;
      });

      autoTable(doc, {
        startY: nextY + 3,
        head: [head1Row1, head1Row2],
        body: body1,
        theme: 'grid',
        styles: { fontSize: 6.8, cellPadding: 1, halign: 'center' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold' }
      });

      const nextY2 = (doc as any).lastAutoTable.finalY + 4;
      const head2Row1: any[] = [
        { content: 'Hora', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      ];
      const head2Row2: any[] = [];
      for (let p = part1Pieces + 1; p <= totalPieces; p++) {
        head2Row1.push({ content: `Peça ${p} (mm)`, colSpan: 4, styles: { halign: 'center' } });
        head2Row2.push('L1', 'L2', 'L3', 'L4');
      }
      head2Row1.push({ content: 'Média Geral', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } });

      const body2 = report.thickness.map(t => {
        const rowVals: string[] = [t.time];
        const allPieceAvgs: number[] = [];

        for (let p = 1; p <= totalPieces; p++) {
          const sides = getPieceSides(t, p);
          const pAvg = getPieceAvg(sides);
          if (pAvg > 0) allPieceAvgs.push(pAvg);

          if (p > part1Pieces) {
            rowVals.push(
              sides[0] > 0 ? sides[0].toFixed(1) : '-',
              sides[1] > 0 ? sides[1].toFixed(1) : '-',
              sides[2] > 0 ? sides[2].toFixed(1) : '-',
              sides[3] > 0 ? sides[3].toFixed(1) : '-'
            );
          }
        }

        const horaAvg = allPieceAvgs.length > 0
          ? (allPieceAvgs.reduce((a, b) => a + b, 0) / allPieceAvgs.length).toFixed(1)
          : '-';
        rowVals.push(horaAvg);
        return rowVals;
      });

      autoTable(doc, {
        startY: nextY2,
        head: [head2Row1, head2Row2],
        body: body2,
        theme: 'grid',
        styles: { fontSize: 6.8, cellPadding: 1, halign: 'center' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold' }
      });
      nextY = (doc as any).lastAutoTable.finalY + 10;
    }
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

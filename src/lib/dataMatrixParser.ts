/**
 * Utilitário avançado de decodificação e extração de dados de códigos Data Matrix 2D
 * e etiquetas industriais cerâmicas (Viva Cerâmica / Padrão GS1 DataMatrix / Scandit).
 */

export interface GS1ParsedField {
  ai: string;
  titlePt: string;
  titleEn: string;
  label: string;
  value: string;
  formattedDisplay: string;
  description: string;
  category: 'product' | 'batch' | 'dimensions' | 'logistics' | 'date' | 'custom';
  extraMeta?: Record<string, any>;
}

export interface ParsedDataMatrix {
  rawText: string;
  isGS1: boolean;
  codeType: 'GS1_DATA_MATRIX' | 'DATA_MATRIX' | 'QR_CODE' | 'TEXT_BARCODE';

  // Campos GS1 extraídos
  gtin?: string;           // AI 02 ou 01
  gtinType?: '02' | '01';
  shade?: string;          // AI 240 (Tom / Tonalidade - onde começa com 240)
  calibre?: string;        // AI 90 (Calibre dimensional - onde começa com 90)
  lot?: string;            // AI 10 (Lote do produto - onde começa com 10)
  count?: string;          // AI 37 (Quantidade peças/caixas)
  areaM2?: string;         // AI 3142 (ex: 2.19 m²)
  areaRaw?: string;        // AI 3142 bruto (000219)
  sscc?: string;           // AI 00 (Código Serial Palete)
  ssccExtension?: string;  // extensionDigit: 0
  productionDate?: string; // AI 11 (YYMMDD)

  // Lista estruturada de campos GS1 para exibição detalhada
  gs1Fields: GS1ParsedField[];

  // Campos integrados com o Relatório
  detectedDate?: string;         // YYYY-MM-DD
  formattedDisplayDate?: string; // DD/MM/YYYY
  detectedShift?: 'A' | 'B' | 'C' | 'D';
  detectedLine?: string;
  detectedModel?: string;
  detectedLot?: string;
  detectedFormat?: string;
  detectedShade?: string;
  detectedSize?: string;
  summary: string;
}

/**
 * Decodifica qualquer entrada:
 * 1. String GS1 DataMatrix bruta com separadores ASCII 29 (<GS>, \x1d, \u001d)
 * 2. Formato GS1 formatado com parênteses: (02)...(240)...(90)...
 * 3. Saída de texto copiada do aplicativo Scandit Demo
 * 4. Cadeia contínua de identificadores cerâmicos Viva Cerâmica
 * 5. JSON ou texto livre com data/turno/lote
 */
export function parseDataMatrixCode(raw: string): ParsedDataMatrix {
  const text = (raw || '').trim();
  const gs1Map: Record<string, string> = {};
  let isGS1 = false;
  let codeType: ParsedDataMatrix['codeType'] = 'DATA_MATRIX';

  let detectedDate: string | undefined;
  let detectedShift: ('A' | 'B' | 'C' | 'D') | undefined;
  let detectedLine: string | undefined;
  let detectedModel: string | undefined;
  let detectedLot: string | undefined;
  let detectedFormat: string | undefined;
  let detectedShade: string | undefined;
  let detectedSize: string | undefined;

  // =========================================================================
  // 1. Verificação se é saída de texto copiada do Scandit Demo
  // =========================================================================
  if (
    text.includes('GTIN') ||
    text.includes('Additional product identification') ||
    text.includes('Batch or lot number') ||
    text.includes('Serial Shipping Container Code') ||
    text.includes('GS1_DATA_MATRIX')
  ) {
    isGS1 = true;
    codeType = 'GS1_DATA_MATRIX';
    parseScanditText(text, gs1Map);
  }

  // =========================================================================
  // 2. Verificação se formato tem parênteses GS1: (02)07908482805010(240)4...
  // =========================================================================
  if (Object.keys(gs1Map).length === 0 && /\(\d{2,4}\)/.test(text)) {
    isGS1 = true;
    codeType = 'GS1_DATA_MATRIX';
    const regex = /\((\d{2,4})\)([^()]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      gs1Map[match[1]] = match[2].trim();
    }
  }

  // =========================================================================
  // 3. Verificação com separador FNC1 / GS (\x1d, \u001d, <GS>, ~d029)
  // =========================================================================
  if (
    Object.keys(gs1Map).length === 0 &&
    (text.includes('\x1d') || text.includes('\u001d') || text.includes('<GS>') || text.includes('~d029'))
  ) {
    isGS1 = true;
    codeType = 'GS1_DATA_MATRIX';
    const clean = text
      .replace(/<GS>/g, '\x1d')
      .replace(/\u001d/g, '\x1d')
      .replace(/~d029/g, '\x1d');
    parseGS1Tokens(clean, gs1Map);
  }

  // =========================================================================
  // 4. Verificação de cadeia contínua industrial (ex: etiqueta Viva Cerâmica)
  // Ex: 0207908482805010240490810000000493772314200021900079084828017406718
  // =========================================================================
  if (Object.keys(gs1Map).length === 0) {
    let cleanText = text;
    if (cleanText.startsWith(']d2') || cleanText.startsWith(']C1')) {
      cleanText = cleanText.substring(3);
    }
    const ceramicPattern = cleanText.match(
      /^(?:02|01)(\d{14})240([A-Za-z0-9_-]+?)90([A-Za-z0-9_-]+?)10(\d{4,12})37(\d{1,6})314(\d)(\d{6})00(\d{18})/
    );
    if (ceramicPattern) {
      isGS1 = true;
      codeType = 'GS1_DATA_MATRIX';
      const aiPrefix = cleanText.startsWith('01') ? '01' : '02';
      gs1Map[aiPrefix] = ceramicPattern[1];
      gs1Map['240'] = ceramicPattern[2];
      gs1Map['90'] = ceramicPattern[3];
      gs1Map['10'] = ceramicPattern[4];
      gs1Map['37'] = ceramicPattern[5];
      const dec = parseInt(ceramicPattern[6], 10);
      const rawVal = ceramicPattern[7];
      const numVal = (parseInt(rawVal, 10) / Math.pow(10, dec)).toFixed(dec);
      gs1Map['3142'] = String(numVal);
      gs1Map['3142_raw'] = rawVal;
      gs1Map['00'] = ceramicPattern[8];
    }
  }

  // =========================================================================
  // 5. Fallback para decodificação genérica de tokens GS1
  // =========================================================================
  if (Object.keys(gs1Map).length === 0) {
    // Tenta identificar se começa com 02 ou 01
    const gtinStart = text.match(/^(?:\]d2)?(01|02)(\d{14})/);
    if (gtinStart) {
      isGS1 = true;
      codeType = 'GS1_DATA_MATRIX';
      gs1Map[gtinStart[1]] = gtinStart[2];
      // Tenta extrair lote 10
      const lotM = text.match(/10(\d{6,10})/);
      if (lotM) gs1Map['10'] = lotM[1];
      // Tenta extrair 37
      const countM = text.match(/37(\d{1,4})/);
      if (countM) gs1Map['37'] = countM[1];
      // Tenta extrair 00
      const ssccM = text.match(/00(\d{18})/);
      if (ssccM) gs1Map['00'] = ssccM[1];
      // Tenta extrair 240
      const calM = text.match(/240([A-Za-z0-9_-]+)/);
      if (calM) gs1Map['240'] = calM[1];
      // Tenta extrair 90
      const shadeM = text.match(/90([A-Za-z0-9_-]+)/);
      if (shadeM) gs1Map['90'] = shadeM[1];
    }
  }

  // =========================================================================
  // 6. Extrações de formato JSON ou texto livre
  // =========================================================================
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const obj = JSON.parse(text);
      if (obj.gtin) gs1Map['02'] = String(obj.gtin);
      if (obj.tom || obj.tonalidade || obj.shade) gs1Map['240'] = String(obj.tom || obj.tonalidade || obj.shade);
      if (obj.lote || obj.lot) gs1Map['90'] = String(obj.lote || obj.lot);
      if (obj.batelada || obj.batch || obj.op) gs1Map['10'] = String(obj.batelada || obj.batch || obj.op);
      if (obj.calibre) gs1Map['calibre'] = String(obj.calibre);
      if (obj.quantidade) gs1Map['37'] = String(obj.quantidade);
      if (obj.areaM2) gs1Map['3142'] = String(obj.areaM2);
      if (obj.areaRaw) gs1Map['3142_raw'] = String(obj.areaRaw);
      if (obj.sscc) gs1Map['00'] = String(obj.sscc);
      if (obj.dataProducao || obj.productionDate) gs1Map['11'] = String(obj.dataProducao || obj.productionDate);
      if (Object.keys(gs1Map).length > 0) {
        isGS1 = true;
        codeType = 'GS1_DATA_MATRIX';
      }

      if (obj.data || obj.date) {
        const d = normalizeDate(String(obj.data || obj.date));
        if (d) detectedDate = d;
      }
      if (obj.turno || obj.shift) {
        const s = String(obj.turno || obj.shift).toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(s)) detectedShift = s as any;
      }
      if (obj.linha || obj.line) detectedLine = String(obj.linha || obj.line);
      if (obj.modelo || obj.model || obj.produto) detectedModel = String(obj.modelo || obj.model || obj.produto);
      if (obj.lote || obj.lot) detectedLot = String(obj.lote || obj.lot);
      if (obj.formato || obj.format) detectedFormat = String(obj.formato || obj.format);
      if (obj.tonalidade || obj.shade || obj.tom) detectedShade = String(obj.tonalidade || obj.shade || obj.tom);
      if (obj.calibre || obj.size) detectedSize = String(obj.calibre || obj.size);
    } catch {
      // continua
    }
  }

  // =========================================================================
  // 7. Montagem dos campos GS1 estruturados
  // Regra de Fábrica Cerâmica:
  // - AI 240: Tom / Tonalidade (onde começa com 240)
  // - AI 90: Calibre dimensional (onde começa com 90)
  // - AI 10: Lote do produto (onde começa com 10)
  // =========================================================================
  const gs1Fields: GS1ParsedField[] = [];

  // (02) ou (01) GTIN
  const gtinVal = gs1Map['02'] || gs1Map['01'];
  const gtinType = gs1Map['02'] ? '02' : gs1Map['01'] ? '01' : undefined;
  if (gtinVal) {
    gs1Fields.push({
      ai: gtinType || '02',
      titlePt: '02. GTIN dos itens de comércio contidos',
      titleEn: '02. GTIN of contained trade items',
      label: 'GTIN do Produto / Caixa',
      value: gtinVal,
      formattedDisplay: `GTIN: ${gtinVal}`,
      description: 'Código de barras de identificação comercial do produto cerâmico (EAN/GTIN-14)',
      category: 'product',
    });
  }

  // (240) Tom / Tonalidade (Regra: Tom fica onde começa com 240)
  if (gs1Map['240']) {
    const val = gs1Map['240'];
    detectedShade = val;
    gs1Fields.push({
      ai: '240',
      titlePt: '240. Tom / Tonalidade do Produto',
      titleEn: '240. Additional product identification (Tone / Shade)',
      label: 'Tom / Tonalidade (240)',
      value: val,
      formattedDisplay: `Tom: ${val}`,
      description: 'Tom / Tonalidade da peça cerâmica (Identificador 240)',
      category: 'batch',
    });
  }

  // (90) Calibre Dimensional (Regra: Calibre fica onde começa com 90)
  if (gs1Map['90']) {
    const val = gs1Map['90'];
    detectedSize = val;
    gs1Fields.push({
      ai: '90',
      titlePt: '90. Calibre Dimensional',
      titleEn: '90. Mutually agreed information (Caliber)',
      label: 'Calibre (90)',
      value: val,
      formattedDisplay: `Cal: ${val}`,
      description: 'Calibre dimensional da peça cerâmica (Identificador 90)',
      category: 'dimensions',
    });
  }

  // (10) Lote do Produto (Regra: Lote fica onde começa com 10)
  if (gs1Map['10']) {
    const val = gs1Map['10'];
    detectedLot = val;
    gs1Fields.push({
      ai: '10',
      titlePt: '10. Lote do Produto',
      titleEn: '10. Batch or lot number',
      label: 'Lote (10)',
      value: val,
      formattedDisplay: `Lote: ${val}`,
      description: 'Número do lote de fabricação cerâmica (Identificador 10)',
      category: 'batch',
    });
  }

  // (37) Quantidade de Peças / Caixas
  if (gs1Map['37']) {
    const val = gs1Map['37'];
    gs1Fields.push({
      ai: '37',
      titlePt: '37. Quantidade de itens de comércio na unidade logística',
      titleEn: '37. Count of trade items or trade item pieces contained in a logistic unit',
      label: 'Quantidade (Caixas/Peças)',
      value: val,
      formattedDisplay: `${val} caixas`,
      description: 'Número de unidades comerciais contidas no palete/embalagem',
      category: 'logistics',
    });
  }

  // (3142 ou 314x) Área em metros quadrados
  if (gs1Map['3142'] || gs1Map['314x'] || gs1Map['3140']) {
    let areaVal = gs1Map['3142'] || gs1Map['314x'] || gs1Map['3140'];
    let areaRaw = gs1Map['3142_raw'] || gs1Map['3142'];
    // Se o valor tiver apenas dígitos e sem ponto, ex: 000219 com AI 3142 (2 decimais) -> 2.19
    if (/^\d{6}$/.test(areaVal)) {
      areaRaw = areaVal;
      areaVal = (parseInt(areaVal, 10) / 100).toFixed(2);
    }
    gs1Fields.push({
      ai: '3142',
      titlePt: '3142. Área, metros quadrados (314x)',
      titleEn: '3142. Area, square metres',
      label: 'Área do Palete / Caixa',
      value: areaVal,
      formattedDisplay: `${areaVal} m²`,
      description: 'Área superficial total em metros quadrados calculada da embalagem',
      category: 'dimensions',
      extraMeta: { raw: areaRaw, decimals: 2 },
    });
  }

  // (00) SSCC - Código Serial da Unidade Logística (Palete)
  if (gs1Map['00']) {
    const val = gs1Map['00'];
    gs1Fields.push({
      ai: '00',
      titlePt: '00. Código de Série de Envio / Palete (SSCC)',
      titleEn: '00. Serial Shipping Container Code (SSCC)',
      label: 'SSCC (Código do Palete)',
      value: val,
      formattedDisplay: `SSCC: ${val} (dígito ext: 0)`,
      description: 'Código de Série da Unidade Logística padrão internacional GS1 (Palete)',
      category: 'logistics',
      extraMeta: { extensionDigit: '0' },
    });
  }

  // (11) Data de Produção se presente
  if (gs1Map['11']) {
    const rawDate = gs1Map['11'];
    if (/^\d{6}$/.test(rawDate)) {
      const yy = parseInt(rawDate.substring(0, 2), 10);
      const mm = parseInt(rawDate.substring(2, 4), 10);
      const dd = parseInt(rawDate.substring(4, 6), 10);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        const year = 2000 + yy;
        detectedDate = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        gs1Fields.push({
          ai: '11',
          titlePt: '11. Data de produção',
          titleEn: '11. Production date',
          label: 'Data de Produção',
          value: detectedDate,
          formattedDisplay: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${year}`,
          description: 'Data de fabricação da peça/palete',
          category: 'date',
        });
      }
    }
  }

  // =========================================================================
  // 8. Se ainda não achou data, procura data comum no texto
  // =========================================================================
  if (!detectedDate) {
    const isoMatch = text.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
    if (isoMatch) {
      detectedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    } else {
      const brMatch = text.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
      if (brMatch) {
        detectedDate = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
      } else {
        const compactMatch = text.match(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
        if (compactMatch) {
          detectedDate = `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
        }
      }
    }
  }

  // Procura Turno
  if (!detectedShift) {
    const shiftMatch = text.match(/(?:TURNO|SHIFT|T:)[\s:=]*([ABCD])\b/i) || text.match(/\bTURNO\s*([ABCD])\b/i);
    if (shiftMatch) {
      detectedShift = shiftMatch[1].toUpperCase() as any;
    }
  }

  // Procura Linha
  if (!detectedLine) {
    const lineMatch = text.match(/(?:LINHA|LINE|L:)[\s:=]*(\d+|[A-Za-z0-9_-]+)/i);
    if (lineMatch) {
      detectedLine = lineMatch[1];
    }
  }

  // Procura Modelo / Produto
  if (!detectedModel) {
    const modelMatch = text.match(/(?:MODELO|PROD|PRODUTO|REF|MODEL)[\s:=]*([A-Za-z0-9_\-\s]{3,30})(?:;|\n|$)/i);
    if (modelMatch) {
      detectedModel = modelMatch[1].trim();
    }
  }

  // Data formatada para exibição
  let formattedDisplayDate: string | undefined;
  if (detectedDate) {
    const parts = detectedDate.split('-');
    if (parts.length === 3) {
      formattedDisplayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  // Resumo amigável
  const summaryParts: string[] = [];
  if (gs1Map['10']) summaryParts.push(`Lote: ${gs1Map['10']}`);
  if (gs1Map['240']) summaryParts.push(`Tom: ${gs1Map['240']}`);
  if (gs1Map['90']) summaryParts.push(`Calibre: ${gs1Map['90']}`);
  if (gs1Map['37']) summaryParts.push(`Qtd: ${gs1Map['37']} cx`);
  if (gs1Map['3142']) summaryParts.push(`Área: ${gs1Map['3142']} m²`);
  if (formattedDisplayDate) summaryParts.push(`Data: ${formattedDisplayDate}`);

  const summary = summaryParts.length > 0 
    ? summaryParts.join(' • ') 
    : (text.length > 40 ? `${text.slice(0, 40)}...` : text);

  return {
    rawText: text,
    isGS1,
    codeType,
    gtin: gtinVal,
    gtinType,
    shade: gs1Map['240'],  // 240 é o Tom / Tonalidade
    calibre: gs1Map['90'], // 90 é o Calibre dimensional
    lot: gs1Map['10'],     // 10 é o Lote do produto
    count: gs1Map['37'],
    areaM2: gs1Map['3142'],
    areaRaw: gs1Map['3142_raw'],
    sscc: gs1Map['00'],
    ssccExtension: gs1Map['00'] ? '0' : undefined,
    productionDate: gs1Map['11'],
    gs1Fields,
    detectedDate,
    formattedDisplayDate,
    detectedShift,
    detectedLine,
    detectedModel,
    detectedLot: detectedLot || gs1Map['10'],
    detectedFormat,
    detectedShade: detectedShade || gs1Map['240'],
    detectedSize: detectedSize || gs1Map['90'],
    summary,
  };
}

/**
 * Faz parse de texto gerado ou copiado do Scandit Demo
 */
function parseScanditText(text: string, map: Record<string, string>) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // 02. GTIN
    if (/^(?:02\.|01\.|GTIN)/i.test(line)) {
      const m = line.match(/(?:GTIN:?\s*)?([0-9]{13,14})/i) || nextLine.match(/(?:GTIN:?\s*)?([0-9]{13,14})/i);
      if (m) map['02'] = m[1];
    }

    // 240. Additional product identification
    if (/^240\./i.test(line) || /Additional product identification/i.test(line)) {
      const m = line.match(/(?:identification\s+|240\.\s*)([A-Za-z0-9_-]+)$/i) || nextLine.match(/^([A-Za-z0-9_-]+)$/);
      if (m) map['240'] = m[1];
    }

    // 90. Information mutually agreed between trading partners
    if (/^90\./i.test(line) || /mutually agreed/i.test(line)) {
      const m = line.match(/(?:partners\s+|90\.\s*)([A-Za-z0-9_-]+)$/i) || nextLine.match(/^([A-Za-z0-9_-]+)$/);
      if (m) map['90'] = m[1];
    }

    // 10. Batch or lot number
    if (/^10\./i.test(line) || /Batch or lot number/i.test(line)) {
      const m = line.match(/(?:number\s+|10\.\s*)([A-Za-z0-9_-]+)$/i) || nextLine.match(/^([A-Za-z0-9_-]+)$/);
      if (m) map['10'] = m[1];
    }

    // 37. Count of trade items
    if (/^37\./i.test(line) || /Count of trade items/i.test(line)) {
      const m = line.match(/(?:unit\s+|37\.\s*)(\d+)$/i) || nextLine.match(/^(\d+)$/);
      if (m) map['37'] = m[1];
    }

    // 3142. Area, square metres ou 314x.
    if (/^314[x0-9]\./i.test(line) || /Area, square metres/i.test(line)) {
      const m = line.match(/(?:metres\s+|314[x0-9]\.\s*)(\d+(?:\.\d+)?)$/i) || nextLine.match(/^(\d+(?:\.\d+)?)$/);
      if (m) {
        // Se for decimal ex 2.19, salva em 3142
        if (m[1].includes('.')) {
          map['3142'] = m[1];
        } else if (m[1].length === 6) {
          map['3142_raw'] = m[1];
          map['3142'] = (parseInt(m[1], 10) / 100).toFixed(2);
        } else {
          map['3142'] = m[1];
        }
      }
    }

    // 00. Serial Shipping Container Code (SSCC)
    if (/^(?:00\.|SSCC)/i.test(line) || /Serial Shipping Container Code/i.test(line)) {
      const m = line.match(/(?:SSCC:?\s*)?([0-9]{18})/i) || nextLine.match(/(?:SSCC:?\s*)?([0-9]{18})/i);
      if (m) map['00'] = m[1];
    }
  }
}

/**
 * Faz parse de tokens separados por ASCII 29 (\x1d)
 */
function parseGS1Tokens(cleanText: string, map: Record<string, string>) {
  const tokens = cleanText.split('\x1d').filter(Boolean);

  for (const token of tokens) {
    let t = token.trim();
    while (t.length > 0) {
      if (t.startsWith(']d2') || t.startsWith(']C1') || t.startsWith(']e0')) {
        t = t.substring(3);
        continue;
      }

      // Identificadores de 4 dígitos: 3142, 3102 etc.
      if (/^3[1-6]\d{2}/.test(t)) {
        const ai = t.substring(0, 4);
        const val = t.substring(4, 10);
        map[ai] = val;
        // Calcula valor decimal se 3142 (área em m² com 2 decimais)
        if (ai.startsWith('314')) {
          const dec = parseInt(ai[3], 10) || 2;
          map['3142_raw'] = val;
          map['3142'] = (parseInt(val, 10) / Math.pow(10, dec)).toFixed(dec);
        }
        t = t.substring(10);
        continue;
      }

      // Identificadores de 3 dígitos: 240, 241, 242, 250, 251
      if (/^(240|241|242|250|251)/.test(t)) {
        const ai = t.substring(0, 3);
        map[ai] = t.substring(3);
        t = '';
        continue;
      }

      // AI 00 - SSCC (18 dígitos fixos)
      if (/^00\d{18}/.test(t)) {
        map['00'] = t.substring(2, 20);
        t = t.substring(20);
        continue;
      }

      // AI 01 / 02 - GTIN (14 dígitos fixos)
      if (/^(01|02)\d{14}/.test(t)) {
        const ai = t.substring(0, 2);
        map[ai] = t.substring(2, 16);
        t = t.substring(16);
        continue;
      }

      // AI 11 / 12 / 13 / 15 / 17 - Datas (6 dígitos YYMMDD fixos)
      if (/^(11|12|13|15|17)\d{6}/.test(t)) {
        const ai = t.substring(0, 2);
        map[ai] = t.substring(2, 8);
        t = t.substring(8);
        continue;
      }

      // AI variáveis de 2 dígitos: 10 (Lote), 37 (Contagem), 90 (Acordado)
      if (/^(10|21|30|37|90|91|92|93|94|95|96|97|98|99)/.test(t)) {
        const ai = t.substring(0, 2);
        map[ai] = t.substring(2);
        t = '';
        continue;
      }

      break;
    }
  }
}

function normalizeDate(str: string): string | undefined {
  if (!str) return undefined;
  const isoMatch = str.match(/(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = str.match(/(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return undefined;
}

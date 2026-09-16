export type ReportStatus = 'EM_ANDAMENTO' | 'FINALIZADO';

export interface MaintenanceReplacement {
  id: string;
  sector: 'Prensas' | 'Linha de Esmaltação' | 'Forno' | 'Retífica' | string;
  machine: string;
  component_name: string;
  replacement_date: string; // YYYY-MM-DD
  mechanic_name: string;
  lifespan_days: number;
  alert_lead_days: number;
  notes?: string;
  created_at?: string;
  syncStatus?: 'synced' | 'pending';
}

export interface VisualCheck {
  id?: string;
  time: string;           // "Início", "14:00", "15:00", ..., "Final"
  tone: string;           // Tom / Tonalidade (ex: "01", "02", "T1", "Claro")
  batch: string;          // Lote (ex: "L01", "L02", "125A")
  visual: string;         // Visual / Aspecto (ex: "Conforme", "Sem variação", "Leve variação", "Bisel OK")
  hasVariation?: boolean; // Se houve variação ou troca de tom/lote neste horário
  observation?: string;   // Observação específica da variação
}

export interface Defect {
  code: number;
  name: string;
}

export interface ProductionLossEntry {
  id: string;
  time: string;
  type: 'granel' | 'caixas_rasgadas' | 'repasses' | 'cacamba_caco';
  quantity: number;
  observation?: string;
}

export interface ProductChangeInfo {
  hasChange?: boolean;
  time?: string;
  newReference: string;
  newGtin?: string;
  newFormat?: string;
  newLot?: string;
  newShade?: string;
  newCalibre?: string;
  observation?: string;
  gs1Info?: GS1DataMatrixInfo;
}

export interface ProductionLosses {
  granel: number;              // Granel (paletes)
  granelUnit?: string;         // 'paletes', 'm²', 'cx', 'pç'
  caixasRasgadas: number;      // Caixas rasgadas
  repasses: number;            // Repasses
  cacambaCaco: number;         // Caçamba de caco
  notes?: string;              // Observações gerais
  entries?: ProductionLossEntry[]; // Lançamentos horários opcionais
}

export interface GS1DataMatrixInfo {
  gtin?: string;               // AI 02 / 01 (GTIN de itens contidos / produto)
  tom?: string;                // AI 240 (Tom / Tonalidade - onde começa com 240)
  calibre?: string;            // AI 90 (Calibre dimensional - onde começa com 90)
  lote?: string;               // AI 10 (Lote do produto - onde começa com 10)
  quantidade?: string | number;// AI 37 (Quantidade de caixas / peças)
  areaM2?: string | number;    // AI 3142 (Área em metros quadrados, ex: 2.19)
  areaRaw?: string;            // AI 3142 bruto (000219)
  sscc?: string;               // AI 00 (SSCC / Código Serial da Unidade Logística)
  extensionDigit?: string;     // AI 00 (Dígito de extensão)
  productionDate?: string;     // AI 11 (Data de produção YYMMDD)
  rawCode?: string;
  formattedSummary?: string;
  scannedAt?: string;
}

export interface Report {
  id: string;
  date: string;
  shift: string;
  line: string;
  leaderName: string;
  format: string;
  reference: string;
  gtin?: string;
  piecesToMeasure?: number;
  productChange?: ProductChangeInfo;
  status: ReportStatus;
  userId?: string;
  createdBy?: string;
  
  thickness: { 
    time: string; 
    cv: string; 
    l1?: number; 
    l2?: number; 
    l3?: number; 
    l4?: number;
    pc1?: number;
    pc1_s?: number[];
    pc2?: number;
    pc2_s?: number[];
    pc3?: number;
    pc3_s?: number[];
    average?: number;
    [key: string]: any;
  }[];
  warp: { time: string; pc1: number; pc1_s?: number[]; pc2: number; pc2_s?: number[]; pc3: number; pc3_s?: number[]; pc4: number; pc4_s?: number[]; pc5: number; pc5_s?: number[]; pc6: number; pc6_s?: number[]; pc7: number; pc7_s?: number[]; [key: string]: any }[];
  centralCurvature: { time: string; pc1: number; pc1_s?: number[]; pc2: number; pc2_s?: number[]; pc3: number; pc3_s?: number[]; pc4: number; pc4_s?: number[]; pc5: number; pc5_s?: number[]; pc6: number; pc6_s?: number[]; pc7: number; pc7_s?: number[]; [key: string]: any }[];
  lateralCurvature: { time: string; pc1: number; pc1_s?: number[]; pc2: number; pc2_s?: number[]; pc3: number; pc3_s?: number[]; pc4: number; pc4_s?: number[]; pc5: number; pc5_s?: number[]; pc6: number; pc6_s?: number[]; pc7: number; pc7_s?: number[]; [key: string]: any }[];
  
  boxWeights: { time: string; weight: number }[];
  processChecks: { time: string; taratura: 'OK' | 'Ruim' | '-'; corte: 'OK' | 'Ruim' | '-'; lascamento: 'OK' | 'Ruim' | '-' }[];

  defects: { defectId: number; name: string; time: string; quantity: number; observation?: string }[];
  visualChecks?: VisualCheck[];
  productionLosses?: ProductionLosses;
  observations: { time: string; description: string }[];
  changes: { time: string; initial: string; final: string; visual: string; observation: string }[];
  
  gs1Info?: GS1DataMatrixInfo;
  lot?: string;
  caliber?: string;
  shade?: string;
  
  processInfo: {
    gramatura?: number;
    carga?: number;
    pressao?: number;
    caixa?: number;
    peso_cx?: number;
    taratura?: 'OK' | 'Ruim';
    corte?: 'OK' | 'Ruim';
    lascamento?: 'OK' | 'Ruim';
  };

  syncStatus: 'synced' | 'pending';
  updatedAt?: string;
}

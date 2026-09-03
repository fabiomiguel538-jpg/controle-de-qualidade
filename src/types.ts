export type ReportStatus = 'EM_ANDAMENTO' | 'FINALIZADO';

export interface Defect {
  code: number;
  name: string;
}

export interface Report {
  id: string;
  date: string;
  shift: string;
  line: string;
  leaderName: string;
  format: string;
  reference: string;
  status: ReportStatus;
  
  thickness: { time: string; cv: string; l1: number; l2: number; l3: number; l4: number }[];
  warp: { time: string; pc1: number; pc1_s?: number[]; pc2: number; pc2_s?: number[]; pc3: number; pc3_s?: number[]; pc4: number; pc4_s?: number[]; pc5: number; pc5_s?: number[]; pc6: number; pc6_s?: number[]; pc7: number; pc7_s?: number[] }[];
  centralCurvature: { time: string; pc1: number; pc1_s?: number[]; pc2: number; pc2_s?: number[]; pc3: number; pc3_s?: number[]; pc4: number; pc4_s?: number[]; pc5: number; pc5_s?: number[]; pc6: number; pc6_s?: number[]; pc7: number; pc7_s?: number[] }[];
  lateralCurvature: { time: string; pc1: number; pc1_s?: number[]; pc2: number; pc2_s?: number[]; pc3: number; pc3_s?: number[]; pc4: number; pc4_s?: number[]; pc5: number; pc5_s?: number[]; pc6: number; pc6_s?: number[]; pc7: number; pc7_s?: number[] }[];
  
  boxWeights: { time: string; weight: number }[];
  processChecks: { time: string; taratura: 'OK' | 'Ruim' | '-'; corte: 'OK' | 'Ruim' | '-'; lascamento: 'OK' | 'Ruim' | '-' }[];

  defects: { defectId: number; name: string; time: string; quantity: number; observation?: string }[];
  observations: { time: string; description: string }[];
  changes: { time: string; initial: string; final: string; visual: string; observation: string }[];
  
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

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useReportStore, Report } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import { ChevronLeft, Plus, Trash2, CheckCircle, Save, FileDown, ArrowRight, Clock, UploadCloud, Check, RefreshCw, Sparkles, Pencil, Edit3, RotateCcw, AlertCircle, Eraser, ShieldAlert, Layers, LayoutGrid, ChevronRight, Package, PackageX, Truck, Boxes } from 'lucide-react';
import { DEFECTS_LIST, SHIFT_HOURS } from '../lib/constants';
import { generatePDF } from '../lib/pdfGenerator';
import { canUserAccessReport } from '../lib/permissions';
import { ProductionLosses, ProductionLossEntry } from '../types';
import clsx from 'clsx';
import CloudSyncBadge from '../components/CloudSyncBadge';
import TimeInput from '../components/TimeInput';
import MeasurementInput from '../components/MeasurementInput';

export default function ReportForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { reports, createNewReport, updateCurrentReport, setCurrentReport, currentReportId, finalizeReport, reopenReport, saveReportNow, isSyncing } = useReportStore();
  
  // Identifica se o usuário logado é o Líder Matriz 2 (ou admin para suporte)
  const isLiderMatriz2 = Boolean(
    user && (
      user.email?.toLowerCase().replace(/\s+/g, '') === 'lidermatriz2' ||
      user.id?.toLowerCase().replace(/\s+/g, '') === 'lidermatriz2' ||
      user.name?.toLowerCase().includes('matriz 2') ||
      user.name?.toLowerCase().includes('matriz2') ||
      user.role === 'ADMIN'
    )
  );

type TabKey = 'info' | 'thickness' | 'integrated' | 'process' | 'weights' | 'losses' | 'defects' | 'obs' | 'summary';

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [selectedIntegratedPiece, setSelectedIntegratedPiece] = useState<number>(0); // 0 a 6 (Pç 1 a 7)
  const [integratedViewMode, setIntegratedViewMode] = useState<'focus' | 'all'>('focus');
  const [defectTime, setDefectTime] = useState(new Date().toTimeString().substring(0, 5));
  const [obsTime, setObsTime] = useState(new Date().toTimeString().substring(0, 5));
  const [defectEntries, setDefectEntries] = useState([{ id: '', amount: '', obs: '' }]);
  const [lossTime, setLossTime] = useState(new Date().toTimeString().substring(0, 5));
  const [lossType, setLossType] = useState<'granel' | 'caixas_rasgadas' | 'repasses' | 'cacamba_caco'>('granel');
  const [lossQuantity, setLossQuantity] = useState<string>('');
  const [lossObs, setLossObs] = useState<string>('');
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isEditingFinalized, setIsEditingFinalized] = useState(searchParams.get('edit') === 'true');

  useEffect(() => {
    if (id) {
      setCurrentReport(id);
    } else {
      if (user?.role === 'ADMIN') {
        navigate('/', { replace: true });
        return;
      }
      const newId = createNewReport({
        leaderName: user?.name,
        userId: user?.id,
        createdBy: user?.email || user?.id,
      });
      navigate(`/reports/edit/${newId}`, { replace: true });
    }
  }, [id, createNewReport, setCurrentReport, navigate, user]);

  const report = reports.find(r => r.id === currentReportId);

  if (!report) return <div className="p-8 text-center">Carregando...</div>;

  // Verificação estrita de permissão de acesso
  const hasAccess = canUserAccessReport(report, user);
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-lg border border-neutral-200 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-lg font-bold text-neutral-800 mb-2">Acesso Restrito</h2>
          <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
            {user?.role === 'ADMIN'
              ? 'Como Administrador, você só tem acesso aos relatórios que já foram finalizados pelos líderes.'
              : 'Você não tem permissão para visualizar ou editar relatórios criados por outros usuários.'}
          </p>
          <Link
            to={user?.role === 'ADMIN' ? '/reports/list?filter=finalizado' : '/'}
            className="w-full inline-block py-3 px-4 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
          >
            {user?.role === 'ADMIN' ? 'Ver Relatórios Finalizados' : 'Voltar ao Painel'}
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';
  const isFinalized = report.status === 'FINALIZADO';
  // Admin only views finalized reports and cannot edit; for leaders, editing is unlocked when isEditingFinalized is true
  const isLocked = isAdmin || (isFinalized && !isEditingFinalized);

  const update = (updates: Partial<Report>) => {
    if (isLocked) return;
    updateCurrentReport(updates);
  };

  const handleSaveAndRegeneratePDF = async () => {
    if (!report) return;
    const success = await saveReportNow(report.id);
    generatePDF(report);
    setIsEditingFinalized(false);
    setSyncFeedback(success ? 'Relatório salvo e PDF atualizado com sucesso!' : 'Salvo no aparelho e PDF atualizado!');
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  const handleReopenReport = async () => {
    if (!report) return;
    if (!confirm('Deseja reabrir este relatório? Ele voltará para o status "Em Andamento".')) return;
    await reopenReport(report.id);
    setIsEditingFinalized(true);
    setSyncFeedback('Relatório reaberto! Agora está com status "Em Andamento".');
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  const handleSendToCloud = async () => {
    if (!report) return;
    const success = await saveReportNow(report.id);
    if (success) {
      setSyncFeedback('Dados enviados para a nuvem com sucesso!');
      setTimeout(() => setSyncFeedback(null), 3500);
    } else {
      setSyncFeedback('Salvo no dispositivo (sem conexão com a nuvem no momento)');
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  };

  const handleFinalize = async () => {
    if (!report.date || !report.shift || !report.line) {
      alert("Existem informações obrigatórias que ainda não foram preenchidas (Data, Turno, Linha).");
      return;
    }
    await finalizeReport(report.id);
    generatePDF(report);
    navigate('/');
  };

  const getNextShiftHour = (existingTimes: string[], shift: string) => {
    const shiftList = SHIFT_HOURS[shift] || SHIFT_HOURS['A'];
    const unused = shiftList.find(h => !existingTimes.includes(h));
    if (unused) return unused;
    return new Date().toTimeString().substring(0, 5);
  };

  const handleDefineShiftHours = (targetShift: string = report.shift) => {
    const hours = SHIFT_HOURS[targetShift] || SHIFT_HOURS['A'];

    const newThickness = hours.map((time, i) => {
      const existing = report.thickness[i];
      return existing ? { ...existing, time } : { 
        time, 
        cv: 'A', 
        l1: 0, 
        l2: 0, 
        l3: 0, 
        l4: 0,
        pc1: 0,
        pc1_s: [0, 0, 0, 0],
        pc2: 0,
        pc2_s: [0, 0, 0, 0],
        pc3: 0,
        pc3_s: [0, 0, 0, 0],
      };
    });

    const newWarp = hours.map((time, i) => {
      const existing = report.warp[i];
      return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
    });

    const newCC = hours.map((time, i) => {
      const existing = report.centralCurvature[i];
      return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
    });

    const newCL = hours.map((time, i) => {
      const existing = report.lateralCurvature[i];
      return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
    });

    const newProcess = hours.map((time, i) => {
      const existing = report.processChecks?.[i];
      return existing ? { ...existing, time } : { time, taratura: '-' as const, corte: '-' as const, lascamento: '-' as const };
    });

    const newBoxWeights = hours.map((time, i) => {
      const existing = report.boxWeights?.[i];
      return existing ? { ...existing, time } : { time, weight: 0 };
    });

    update({
      shift: targetShift,
      thickness: newThickness,
      warp: newWarp,
      centralCurvature: newCC,
      lateralCurvature: newCL,
      processChecks: newProcess,
      boxWeights: newBoxWeights,
    });

    setSyncFeedback(`Horários do Turno ${targetShift} definidos com sucesso! (${hours[0]} às ${hours[hours.length - 1]})`);
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  const handleDefineShiftHoursForSection = (section: 'thickness' | 'warp' | 'centralCurvature' | 'lateralCurvature' | 'process' | 'weights') => {
    const hours = SHIFT_HOURS[report.shift] || SHIFT_HOURS['A'];

    if (section === 'thickness') {
      const updated = hours.map((time, i) => {
        const existing = report.thickness[i];
        return existing ? { ...existing, time } : { 
          time, 
          cv: 'A', 
          l1: 0, 
          l2: 0, 
          l3: 0, 
          l4: 0,
          pc1: 0,
          pc1_s: [0, 0, 0, 0],
          pc2: 0,
          pc2_s: [0, 0, 0, 0],
          pc3: 0,
          pc3_s: [0, 0, 0, 0],
        };
      });
      update({ thickness: updated });
    } else if (section === 'warp') {
      const updated = hours.map((time, i) => {
        const existing = report.warp[i];
        return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
      });
      update({ warp: updated });
    } else if (section === 'centralCurvature') {
      const updated = hours.map((time, i) => {
        const existing = report.centralCurvature[i];
        return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
      });
      update({ centralCurvature: updated });
    } else if (section === 'lateralCurvature') {
      const updated = hours.map((time, i) => {
        const existing = report.lateralCurvature[i];
        return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
      });
      update({ lateralCurvature: updated });
    } else if (section === 'process') {
      const updated = hours.map((time, i) => {
        const existing = report.processChecks?.[i];
        return existing ? { ...existing, time } : { time, taratura: '-' as const, corte: '-' as const, lascamento: '-' as const };
      });
      update({ processChecks: updated });
    } else if (section === 'weights') {
      const updated = hours.map((time, i) => {
        const existing = report.boxWeights?.[i];
        return existing ? { ...existing, time } : { time, weight: 0 };
      });
      update({ boxWeights: updated });
    }

    setSyncFeedback(`Horários do Turno ${report.shift} definidos para esta seção!`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Helper para gerar número aleatório próximo ao valor manual base (com 1 casa decimal)
  const generateCloseValue = (base: number): number => {
    if (base === 0) return 0;
    // Variações aleatórias pequenas e naturais em torno do valor base (ex: 0.4 -> 0.3, 0.4, 0.5):
    const deltas = [-0.2, -0.1, -0.1, 0, 0, 0, 0.1, 0.1, 0.2];
    const delta = deltas[Math.floor(Math.random() * deltas.length)];
    let result = Math.round((base + delta) * 10) / 10;
    if (result < 0) result = 0;
    return result;
  };

  // Preenche as peças 2 a 7 de uma medição com números próximos da 1ª peça (PC1)
  const handleAutoFillPieces = (key: 'warp' | 'centralCurvature' | 'lateralCurvature', rowIndex: number) => {
    const list = [...(report as any)[key]];
    const row = { ...list[rowIndex] };

    // Obter os valores dos 4 lados da Peça 1 (L1, L2, L3, L4)
    let pc1Sides: number[] = Array.isArray(row.pc1_s) ? [...row.pc1_s] : [0, 0, 0, 0];
    while (pc1Sides.length < 4) pc1Sides.push(0);

    // Se todos os lados estiverem 0 mas row.pc1 tiver valor, define no L1
    const hasSides = pc1Sides.some((v) => (v || 0) > 0);
    if (!hasSides && (row.pc1 || 0) > 0) {
      pc1Sides[0] = row.pc1;
      row.pc1_s = [...pc1Sides];
    }

    const baseMax = Math.max(...pc1Sides.map((v) => v || 0));
    if (baseMax === 0 && (!row.pc1 || row.pc1 === 0)) {
      setSyncFeedback('⚠️ Digite a medida da Peça 1 (L1..L4) primeiro para gerar as outras!');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    const cols = ['pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7'];
    cols.forEach((col) => {
      const newSides = pc1Sides.map((baseVal) => {
        if (!baseVal || baseVal === 0) return 0;
        return generateCloseValue(baseVal);
      });
      row[`${col}_s`] = newSides;
      row[col] = Math.max(...newSides.map((v) => v || 0));
    });

    list[rowIndex] = row;
    update({ [key]: list });
    setSyncFeedback('✨ Peças 2 a 7 preenchidas automaticamente com números próximos da 1ª peça!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Preenche as peças 2 a 7 em todas as medições que possuam a Peça 1 preenchida
  const handleAutoFillAllPieces = (key: 'warp' | 'centralCurvature' | 'lateralCurvature') => {
    const list = [...(report as any)[key]];
    let filledCount = 0;

    const updated = list.map((item) => {
      const row = { ...item };
      let pc1Sides: number[] = Array.isArray(row.pc1_s) ? [...row.pc1_s] : [0, 0, 0, 0];
      while (pc1Sides.length < 4) pc1Sides.push(0);

      const hasSides = pc1Sides.some((v) => (v || 0) > 0);
      if (!hasSides && (row.pc1 || 0) > 0) {
        pc1Sides[0] = row.pc1;
        row.pc1_s = [...pc1Sides];
      }

      const baseMax = Math.max(...pc1Sides.map((v) => v || 0));
      if (baseMax > 0 || (row.pc1 || 0) > 0) {
        filledCount++;
        const cols = ['pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7'];
        cols.forEach((col) => {
          const newSides = pc1Sides.map((baseVal) => {
            if (!baseVal || baseVal === 0) return 0;
            return generateCloseValue(baseVal);
          });
          row[`${col}_s`] = newSides;
          row[col] = Math.max(...newSides.map((v) => v || 0));
        });
      }
      return row;
    });

    if (filledCount === 0) {
      setSyncFeedback('⚠️ Nenhuma medição possui valores na Peça 1 para calcular!');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    update({ [key]: updated });
    setSyncFeedback(`✨ Peças 2 a 7 geradas em ${filledCount} medição(ões)!`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Apaga os valores de uma única peça (1 a 7)
  const handleClearSinglePiece = (key: 'warp' | 'centralCurvature' | 'lateralCurvature', rowIndex: number, col: string) => {
    const list = [...(report as any)[key]];
    const row = { ...list[rowIndex] };
    row[col] = 0;
    row[`${col}_s`] = [0, 0, 0, 0];
    list[rowIndex] = row;
    update({ [key]: list });
    const pcNum = col.replace('pc', '');
    setSyncFeedback(`Medidas da Peça ${pcNum} apagadas.`);
    setTimeout(() => setSyncFeedback(null), 2500);
  };

  // Apaga as 7 peças (ou peças 2 a 7) de uma medição específica
  const handleClearMeasurementPieces = (key: 'warp' | 'centralCurvature' | 'lateralCurvature', rowIndex: number, mode: 'all' | '2to7' = 'all') => {
    const list = [...(report as any)[key]];
    const row = { ...list[rowIndex] };
    const targetCols = mode === 'all' 
      ? ['pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7'] 
      : ['pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7'];

    targetCols.forEach((col) => {
      row[col] = 0;
      row[`${col}_s`] = [0, 0, 0, 0];
    });

    list[rowIndex] = row;
    update({ [key]: list });
    setSyncFeedback(mode === 'all' ? '🗑️ Valores das 7 peças apagados nesta medição!' : '🗑️ Peças 2 a 7 apagadas nesta medição!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Apaga as 7 peças em todas as medições da aba
  const handleClearAllMeasurementsPieces = (key: 'warp' | 'centralCurvature' | 'lateralCurvature') => {
    if (!confirm('Deseja apagar os valores das 7 peças de todas as medições desta aba?')) return;
    const list = [...(report as any)[key]];
    const targetCols = ['pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7'];

    const updated = list.map((item) => {
      const row = { ...item };
      targetCols.forEach((col) => {
        row[col] = 0;
        row[`${col}_s`] = [0, 0, 0, 0];
      });
      return row;
    });

    update({ [key]: updated });
    setSyncFeedback('🗑️ Valores das 7 peças apagados em todas as medições desta aba!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // --- HELPERS DE ESPESSURA (3 PEÇAS POR HORA) ---
  const getThicknessSides = (item: any, col: 'pc1' | 'pc2' | 'pc3'): number[] => {
    if (Array.isArray(item[`${col}_s`])) {
      const s = [...item[`${col}_s`]];
      while (s.length < 4) s.push(0);
      return s;
    }
    if (col === 'pc1') {
      if ((item.l1 || 0) > 0 || (item.l2 || 0) > 0 || (item.l3 || 0) > 0 || (item.l4 || 0) > 0) {
        return [item.l1 || 0, item.l2 || 0, item.l3 || 0, item.l4 || 0];
      }
    }
    return [0, 0, 0, 0];
  };

  const getThicknessVal = (item: any, col: 'pc1' | 'pc2' | 'pc3'): number => {
    if (typeof item[col] === 'number' && item[col] > 0) return item[col];
    const sides = getThicknessSides(item, col);
    const valid = sides.filter(v => (v || 0) > 0);
    if (valid.length > 0) {
      return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
    }
    return 0;
  };

  const handleAutoFillThicknessPieces = (rowIndex: number) => {
    const list = [...report.thickness];
    const row = { ...list[rowIndex] };

    let p1Sides = getThicknessSides(row, 'pc1');
    let p1Val = getThicknessVal(row, 'pc1');

    if (p1Val === 0 && !p1Sides.some(v => (v || 0) > 0)) {
      setSyncFeedback('⚠️ Digite a medida da Peça 1 primeiro para gerar as peças 2 e 3!');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    if (!p1Sides.some(v => (v || 0) > 0) && p1Val > 0) {
      p1Sides = [p1Val, p1Val, p1Val, p1Val];
      row.pc1_s = p1Sides;
      row.pc1 = p1Val;
    }

    const cols: ('pc2' | 'pc3')[] = ['pc2', 'pc3'];
    cols.forEach((col) => {
      const newSides = p1Sides.map(base => {
        if (!base || base === 0) return 0;
        return generateCloseValue(base);
      });
      row[`${col}_s`] = newSides;
      const valid = newSides.filter(v => (v || 0) > 0);
      row[col] = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0;
    });

    list[rowIndex] = row;
    update({ thickness: list });
    setSyncFeedback('✨ Peças 2 e 3 preenchidas com números próximos da 1ª peça!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleAutoFillAllThicknessPieces = () => {
    const list = [...report.thickness];
    let filledCount = 0;

    const updated = list.map(item => {
      const row = { ...item };
      let p1Sides = getThicknessSides(row, 'pc1');
      let p1Val = getThicknessVal(row, 'pc1');

      if (p1Val > 0 || p1Sides.some(v => (v || 0) > 0)) {
        filledCount++;
        if (!p1Sides.some(v => (v || 0) > 0) && p1Val > 0) {
          p1Sides = [p1Val, p1Val, p1Val, p1Val];
          row.pc1_s = p1Sides;
          row.pc1 = p1Val;
        }
        const cols: ('pc2' | 'pc3')[] = ['pc2', 'pc3'];
        cols.forEach((col) => {
          const newSides = p1Sides.map(base => {
            if (!base || base === 0) return 0;
            return generateCloseValue(base);
          });
          row[`${col}_s`] = newSides;
          const valid = newSides.filter(v => (v || 0) > 0);
          row[col] = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0;
        });
      }
      return row;
    });

    if (filledCount === 0) {
      setSyncFeedback('⚠️ Nenhuma medição possui valores na Peça 1 para calcular!');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    update({ thickness: updated });
    setSyncFeedback(`✨ Peças 2 e 3 geradas em ${filledCount} medição(ões) de Espessura!`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleClearSingleThicknessPiece = (rowIndex: number, col: 'pc1' | 'pc2' | 'pc3') => {
    const list = [...report.thickness];
    const row = { ...list[rowIndex] };
    row[col] = 0;
    row[`${col}_s`] = [0, 0, 0, 0];
    if (col === 'pc1') {
      row.l1 = 0;
      row.l2 = 0;
      row.l3 = 0;
      row.l4 = 0;
    }
    list[rowIndex] = row;
    update({ thickness: list });
    const pcNum = col.replace('pc', '');
    setSyncFeedback(`Medidas da Peça ${pcNum} apagadas.`);
    setTimeout(() => setSyncFeedback(null), 2500);
  };

  const handleClearThicknessRowPieces = (rowIndex: number, mode: 'all' | '2to3' = 'all') => {
    const list = [...report.thickness];
    const row = { ...list[rowIndex] };
    const targetCols: ('pc1' | 'pc2' | 'pc3')[] = mode === 'all' ? ['pc1', 'pc2', 'pc3'] : ['pc2', 'pc3'];
    targetCols.forEach(col => {
      row[col] = 0;
      row[`${col}_s`] = [0, 0, 0, 0];
      if (col === 'pc1') {
        row.l1 = 0;
        row.l2 = 0;
        row.l3 = 0;
        row.l4 = 0;
      }
    });
    list[rowIndex] = row;
    update({ thickness: list });
    setSyncFeedback(mode === 'all' ? '🗑️ Valores das 3 peças apagados nesta medição!' : '🗑️ Peças 2 e 3 apagadas nesta medição!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleClearAllThicknessPieces = () => {
    if (!confirm('Deseja apagar os valores das 3 peças de todas as medições de Espessura?')) return;
    const list = report.thickness.map(item => {
      const row = { ...item };
      row.pc1 = 0;
      row.pc1_s = [0, 0, 0, 0];
      row.pc2 = 0;
      row.pc2_s = [0, 0, 0, 0];
      row.pc3 = 0;
      row.pc3_s = [0, 0, 0, 0];
      row.l1 = 0;
      row.l2 = 0;
      row.l3 = 0;
      row.l4 = 0;
      return row;
    });
    update({ thickness: list });
    setSyncFeedback('🗑️ Valores das 3 peças apagados em todas as medições de Espessura!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // --- HELPERS PARA MEDIÇÃO INTEGRADA (EMPENO + CURVATURAS JUNTOS POR LADO) ---
  const getSideValue = (
    key: 'warp' | 'centralCurvature' | 'lateralCurvature',
    rowIndex: number,
    pcIdx: number,
    sideIdx: number
  ): number => {
    const list = (report as any)[key] || [];
    const item = list[rowIndex];
    if (!item) return 0;
    const col = `pc${pcIdx + 1}`;
    const sides = item[`${col}_s`];
    if (Array.isArray(sides) && sides[sideIdx] !== undefined) {
      return sides[sideIdx] || 0;
    }
    if (pcIdx === 0 && sideIdx === 0 && item[col]) {
      return item[col] || 0;
    }
    return 0;
  };

  const handleSetSideValue = (
    key: 'warp' | 'centralCurvature' | 'lateralCurvature',
    rowIndex: number,
    pcIdx: number,
    sideIdx: number,
    val: number
  ) => {
    if (isLocked) return;
    const currentList = [...((report as any)[key] || [])];
    
    while (currentList.length <= rowIndex) {
      const refTime = report.warp?.[currentList.length]?.time || 
                       report.centralCurvature?.[currentList.length]?.time || 
                       report.lateralCurvature?.[currentList.length]?.time ||
                       getNextShiftHour(currentList.map((t: any) => t.time), report.shift);
      currentList.push({
        time: refTime,
        pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0
      });
    }

    const row = { ...currentList[rowIndex] };
    const col = `pc${pcIdx + 1}`;
    const colSidesKey = `${col}_s`;
    const existingSides: number[] = Array.isArray(row[colSidesKey]) 
      ? [...row[colSidesKey]] 
      : [0, 0, 0, 0];
    
    while (existingSides.length < 4) existingSides.push(0);
    existingSides[sideIdx] = val;
    row[colSidesKey] = existingSides;
    row[col] = Math.max(...existingSides.map((v: number) => v || 0));

    currentList[rowIndex] = row;
    update({ [key]: currentList });
  };

  const getPieceMax = (
    key: 'warp' | 'centralCurvature' | 'lateralCurvature',
    rowIndex: number,
    pcIdx: number
  ): number => {
    const list = (report as any)[key] || [];
    const item = list[rowIndex];
    if (!item) return 0;
    const col = `pc${pcIdx + 1}`;
    return item[col] || 0;
  };

  const getHourMax = (
    key: 'warp' | 'centralCurvature' | 'lateralCurvature',
    rowIndex: number
  ): number => {
    const list = (report as any)[key] || [];
    const item = list[rowIndex];
    if (!item) return 0;
    return Math.max(
      item.pc1 || 0,
      item.pc2 || 0,
      item.pc3 || 0,
      item.pc4 || 0,
      item.pc5 || 0,
      item.pc6 || 0,
      item.pc7 || 0
    );
  };

  const handleDefineShiftHoursIntegrated = () => {
    const hours = SHIFT_HOURS[report.shift] || SHIFT_HOURS['A'];

    const newWarp = hours.map((time, i) => {
      const existing = report.warp?.[i];
      return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
    });

    const newCC = hours.map((time, i) => {
      const existing = report.centralCurvature?.[i];
      return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
    });

    const newCL = hours.map((time, i) => {
      const existing = report.lateralCurvature?.[i];
      return existing ? { ...existing, time } : { time, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
    });

    update({
      warp: newWarp,
      centralCurvature: newCC,
      lateralCurvature: newCL
    });

    setSyncFeedback(`Horários do Turno ${report.shift} sincronizados para Empeno e Curvaturas!`);
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  const handleAddIntegratedMeasurement = () => {
    const existingTimes = (report.warp || []).map((t: any) => t.time);
    const nextTime = getNextShiftHour(existingTimes, report.shift);

    const newRow = { time: nextTime, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 };
    update({
      warp: [...(report.warp || []), { ...newRow }],
      centralCurvature: [...(report.centralCurvature || []), { ...newRow }],
      lateralCurvature: [...(report.lateralCurvature || []), { ...newRow }]
    });
  };

  const handleRemoveIntegratedMeasurement = (index: number) => {
    const newW = [...(report.warp || [])];
    const newCC = [...(report.centralCurvature || [])];
    const newCL = [...(report.lateralCurvature || [])];

    if (newW[index]) newW.splice(index, 1);
    if (newCC[index]) newCC.splice(index, 1);
    if (newCL[index]) newCL.splice(index, 1);

    update({
      warp: newW,
      centralCurvature: newCC,
      lateralCurvature: newCL
    });
  };

  const handleUpdateIntegratedTime = (index: number, newTime: string) => {
    const newW = [...(report.warp || [])];
    const newCC = [...(report.centralCurvature || [])];
    const newCL = [...(report.lateralCurvature || [])];

    if (newW[index]) newW[index] = { ...newW[index], time: newTime };
    if (newCC[index]) newCC[index] = { ...newCC[index], time: newTime };
    if (newCL[index]) newCL[index] = { ...newCL[index], time: newTime };

    update({
      warp: newW,
      centralCurvature: newCC,
      lateralCurvature: newCL
    });
  };

  const handleAutoFillAllIntegratedPiecesForRow = (rowIndex: number) => {
    handleAutoFillPieces('warp', rowIndex);
    handleAutoFillPieces('centralCurvature', rowIndex);
    handleAutoFillPieces('lateralCurvature', rowIndex);
    setSyncFeedback('✨ Peças 2 a 7 geradas em Empeno, Curv. Central e Curv. Lateral!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleAutoFillAllIntegratedInAllRows = () => {
    handleAutoFillAllPieces('warp');
    handleAutoFillAllPieces('centralCurvature');
    handleAutoFillAllPieces('lateralCurvature');
    setSyncFeedback('✨ Peças 2 a 7 geradas em todas as medições de Empeno e Curvaturas!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleClearIntegratedRowPieces = (rowIndex: number, mode: 'all' | '2to7' = 'all') => {
    handleClearMeasurementPieces('warp', rowIndex, mode);
    handleClearMeasurementPieces('centralCurvature', rowIndex, mode);
    handleClearMeasurementPieces('lateralCurvature', rowIndex, mode);
    setSyncFeedback(mode === 'all' ? '🗑️ Medidas de Empeno e Curvaturas apagadas nesta hora!' : '🗑️ Peças 2 a 7 apagadas nesta hora!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleClearSingleIntegratedPiece = (rowIndex: number, pcIdx: number) => {
    const col = `pc${pcIdx + 1}`;
    handleClearSinglePiece('warp', rowIndex, col);
    handleClearSinglePiece('centralCurvature', rowIndex, col);
    handleClearSinglePiece('lateralCurvature', rowIndex, col);
    setSyncFeedback(`Medidas da Peça ${pcIdx + 1} apagadas.`);
    setTimeout(() => setSyncFeedback(null), 2500);
  };

  const handleClearAllIntegratedPieces = () => {
    if (!confirm('Deseja apagar as medidas de Empeno, Curvatura Central e Curvatura Lateral de todas as horas?')) return;
    handleClearAllMeasurementsPieces('warp');
    handleClearAllMeasurementsPieces('centralCurvature');
    handleClearAllMeasurementsPieces('lateralCurvature');
  };

  const TABS: { id: TabKey; label: string }[] = [
    { id: 'info', label: 'Identificação' },
    { id: 'thickness', label: 'Espessura' },
    { id: 'integrated', label: 'Empeno & Curvaturas' },
    { id: 'process', label: 'Processo' },
    { id: 'weights', label: 'Pesagem Caixa' },
    { id: 'losses', label: 'Granel & Repasses' },
    { id: 'defects', label: 'Defeitos' },
    { id: 'obs', label: 'Observações' },
    { id: 'summary', label: 'Resumo & PDF' }
  ];

  // Renderiza a tabela dos 4 lados de uma única peça com as 3 medições juntas
  const renderPieceIntegratedTable = (rowIndex: number, pcIdx: number) => {
    const pWarpMax = getPieceMax('warp', rowIndex, pcIdx);
    const pCCMax = getPieceMax('centralCurvature', rowIndex, pcIdx);
    const pCLMax = getPieceMax('lateralCurvature', rowIndex, pcIdx);
    const hasValues = pWarpMax > 0 || pCCMax > 0 || pCLMax > 0;

    return (
      <div key={pcIdx} className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
        {/* Topo da Peça */}
        <div className="px-3 py-2 bg-neutral-50/90 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs text-neutral-800 flex items-center gap-1.5">
              <span>Peça {pcIdx + 1}</span>
              {hasValues ? (
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Medições cadastradas" />
              ) : (
                <span className="text-[10px] text-neutral-400 font-normal">(sem dados)</span>
              )}
            </span>
            {!isLocked && (
              <button
                type="button"
                onClick={() => handleClearSingleIntegratedPiece(rowIndex, pcIdx)}
                className="text-[10px] text-neutral-400 hover:text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors"
                title={`Limpar valores da Peça ${pcIdx + 1}`}
              >
                <Eraser size={10} />
                <span>Limpar</span>
              </button>
            )}
            {isLiderMatriz2 && !isLocked && pcIdx === 0 && (
              <button
                type="button"
                onClick={() => handleAutoFillAllIntegratedPiecesForRow(rowIndex)}
                className="text-[9px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 active:scale-95 transition-all"
                title="Gera peças 2 a 7 para Empeno, CC e CL com base nesta Peça 1"
              >
                <Sparkles size={10} className="text-amber-600 stroke-[2.5]" />
                <span>Gerar Pçs 2 a 7</span>
              </button>
            )}
          </div>

          {/* Resumo do maior da Peça */}
          <div className="flex items-center gap-1 text-[10px]">
            <span className="bg-amber-100/90 text-amber-900 font-bold px-1.5 py-0.5 rounded border border-amber-200/80" title="Maior Empeno da Peça">
              Empeno: <strong className="font-black">{pWarpMax}</strong>
            </span>
            <span className="bg-blue-100/90 text-blue-900 font-bold px-1.5 py-0.5 rounded border border-blue-200/80" title="Maior Curvatura Central da Peça">
              CC: <strong className="font-black">{pCCMax}</strong>
            </span>
            <span className="bg-emerald-100/90 text-emerald-900 font-bold px-1.5 py-0.5 rounded border border-emerald-200/80" title="Maior Curvatura Lateral da Peça">
              CL: <strong className="font-black">{pCLMax}</strong>
            </span>
          </div>
        </div>

        {/* Tabela dos 4 lados x 3 medições */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-neutral-100/70 text-neutral-600 font-bold border-b border-neutral-200 text-[11px]">
                <th className="py-2 px-2.5 text-left font-bold w-20 sm:w-24 text-neutral-700">Lado</th>
                <th className="py-2 px-2 text-amber-900 bg-amber-50/80 border-x border-neutral-200">
                  <div className="flex items-center justify-center gap-1">
                    <span>📐 Empeno</span>
                  </div>
                </th>
                <th className="py-2 px-2 text-blue-900 bg-blue-50/80 border-r border-neutral-200">
                  <div className="flex items-center justify-center gap-1">
                    <span>🔘 Curv. Central</span>
                  </div>
                </th>
                <th className="py-2 px-2 text-emerald-900 bg-emerald-50/80">
                  <div className="flex items-center justify-center gap-1">
                    <span>↔️ Curv. Lateral</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[0, 1, 2, 3].map((sideIdx) => (
                <tr key={sideIdx} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="py-2 px-2.5 text-left font-bold text-neutral-800 bg-neutral-50/40">
                    <span className="inline-block px-1.5 py-0.5 bg-neutral-200/70 text-neutral-800 rounded font-black text-[11px]">
                      Lado {sideIdx + 1} (L{sideIdx + 1})
                    </span>
                  </td>
                  <td className="py-1.5 px-2 bg-amber-50/20 border-x border-neutral-100">
                    <MeasurementInput
                      value={getSideValue('warp', rowIndex, pcIdx, sideIdx)}
                      onChange={(val) => handleSetSideValue('warp', rowIndex, pcIdx, sideIdx, val)}
                      disabled={isLocked}
                      placeholder="0.0"
                      className="w-20 sm:w-24 mx-auto py-1 px-1.5 text-center text-xs font-bold border border-amber-300 rounded-md bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-400 outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2 bg-blue-50/20 border-r border-neutral-100">
                    <MeasurementInput
                      value={getSideValue('centralCurvature', rowIndex, pcIdx, sideIdx)}
                      onChange={(val) => handleSetSideValue('centralCurvature', rowIndex, pcIdx, sideIdx, val)}
                      disabled={isLocked}
                      placeholder="0.0"
                      className="w-20 sm:w-24 mx-auto py-1 px-1.5 text-center text-xs font-bold border border-blue-300 rounded-md bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2 bg-emerald-50/20">
                    <MeasurementInput
                      value={getSideValue('lateralCurvature', rowIndex, pcIdx, sideIdx)}
                      onChange={(val) => handleSetSideValue('lateralCurvature', rowIndex, pcIdx, sideIdx, val)}
                      disabled={isLocked}
                      placeholder="0.0"
                      className="w-20 sm:w-24 mx-auto py-1 px-1.5 text-center text-xs font-bold border border-emerald-300 rounded-md bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-100 font-bold border-t border-neutral-200 text-xs">
                <td className="py-1.5 px-2.5 text-left text-neutral-500 text-[10px] font-black uppercase tracking-wider">
                  MAIOR DA PEÇA:
                </td>
                <td className="py-1.5 px-2 text-amber-900 border-x border-neutral-200 bg-amber-100/70 font-black text-xs">
                  {pWarpMax}
                </td>
                <td className="py-1.5 px-2 text-blue-900 border-r border-neutral-200 bg-blue-100/70 font-black text-xs">
                  {pCCMax}
                </td>
                <td className="py-1.5 px-2 text-emerald-900 bg-emerald-100/70 font-black text-xs">
                  {pCLMax}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // Renderiza a seção integrada de bancada (Empeno + Curvatura Central + Curvatura Lateral juntos)
  const renderIntegratedSection = () => {
    const integratedLength = Math.max(
      report.warp?.length || 0,
      report.centralCurvature?.length || 0,
      report.lateralCurvature?.length || 0
    );

    return (
      <div className="space-y-3 w-full max-w-6xl mx-auto">
        {/* Painel de Apresentação e Controles Globais */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-neutral-200">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3 pb-2.5 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                  <Layers size={18} />
                </span>
                <h2 className="text-sm sm:text-base font-bold text-neutral-800">
                  Medição Integrada por Lado (Empeno + Curvaturas)
                </h2>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Ao medir um lado da peça na bancada (L1..L4), preencha Empeno, Curvatura Central e Lateral juntos na mesma linha.
              </p>
            </div>

            {/* Alternância de Modo de Visualização */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
              <button
                type="button"
                onClick={() => setIntegratedViewMode('focus')}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                  integratedViewMode === 'focus' 
                    ? "bg-white text-neutral-900 shadow-xs" 
                    : "text-neutral-600 hover:text-neutral-900"
                )}
                title="Focar em uma peça por vez com navegação rápida"
              >
                <span>Foco Peça a Peça</span>
              </button>
              <button
                type="button"
                onClick={() => setIntegratedViewMode('all')}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                  integratedViewMode === 'all' 
                    ? "bg-white text-neutral-900 shadow-xs" 
                    : "text-neutral-600 hover:text-neutral-900"
                )}
                title="Ver todas as 7 peças em grade"
              >
                <LayoutGrid size={13} />
                <span>Todas as 7 Peças</span>
              </button>
            </div>
          </div>

          {/* Barra de Ferramentas / Ações */}
          {!isLocked && (
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button 
                  type="button"
                  onClick={handleDefineShiftHoursIntegrated}
                  className="flex items-center text-[11px] font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-md border border-neutral-200 active:scale-95 transition-all shadow-2xs"
                  title="Aplica os horários do turno simultaneamente em Empeno e Curvaturas"
                >
                  <Clock size={12} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
                </button>

                {isLiderMatriz2 && integratedLength > 0 && (
                  <button 
                    type="button"
                    onClick={handleAutoFillAllIntegratedInAllRows}
                    className="flex items-center text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300 active:scale-95 transition-all shadow-2xs"
                    title="Preenche automaticamente peças 2 a 7 para Empeno e Curvaturas em todas as horas"
                  >
                    <Sparkles size={12} className="mr-1 text-amber-600 stroke-[2.5]" /> Auto Pçs 2-7 em Todas
                  </button>
                )}

                {integratedLength > 0 && (
                  <button 
                    type="button"
                    onClick={handleClearAllIntegratedPieces}
                    className="flex items-center text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md border border-red-200 active:scale-95 transition-all"
                    title="Apagar medidas de todas as horas"
                  >
                    <Eraser size={12} className="mr-1 text-red-500" /> Limpar Todas
                  </button>
                )}
              </div>

              <button 
                type="button"
                onClick={handleAddIntegratedMeasurement}
                className="flex items-center text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1 rounded-md border border-orange-200 active:scale-95 transition-all shadow-2xs"
              >
                <Plus size={13} className="mr-1" /> Adicionar Medição
              </button>
            </div>
          )}
        </div>

        {/* Lista de Medições Horárias */}
        {integratedLength === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-dashed border-neutral-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto">
              <Layers size={24} />
            </div>
            <div>
              <p className="font-bold text-sm text-neutral-800">Nenhuma medição cadastrada ainda.</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                Clique no botão abaixo para preencher automaticamente as 8 horas do Turno {report.shift} ou adicione um horário avulso.
              </p>
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={handleDefineShiftHoursIntegrated}
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <Clock size={13} className="text-orange-400" />
                <span>Preencher Horários do Turno {report.shift}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: integratedLength }).map((_, rowIndex) => {
              const currentTime = report.warp?.[rowIndex]?.time || 
                                  report.centralCurvature?.[rowIndex]?.time || 
                                  report.lateralCurvature?.[rowIndex]?.time || 
                                  '00:00';
              const hourWarpMax = getHourMax('warp', rowIndex);
              const hourCCMax = getHourMax('centralCurvature', rowIndex);
              const hourCLMax = getHourMax('lateralCurvature', rowIndex);

              return (
                <div key={rowIndex} className="p-2.5 sm:p-3 border border-neutral-200 rounded-xl bg-neutral-50/90 shadow-2xs space-y-2.5">
                  {/* Cabeçalho da Medição Horária */}
                  <div className="bg-white p-2 rounded-lg border border-neutral-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="w-28 sm:w-32">
                        <TimeInput
                          value={currentTime}
                          onChange={(newTime) => handleUpdateIntegratedTime(rowIndex, newTime)}
                          disabled={isLocked}
                          shift={report.shift}
                          className="py-1 px-1.5 text-xs font-bold"
                          label={`Medição ${rowIndex + 1} - Empeno e Curvaturas`}
                        />
                      </div>
                      <span className="text-[11px] text-neutral-500 font-semibold hidden sm:inline">
                        Medição {rowIndex + 1}
                      </span>
                    </div>

                    {/* Ações da Medição Horária */}
                    <div className="flex flex-wrap items-center gap-1">
                      {isLiderMatriz2 && !isLocked && (
                        <button 
                          type="button"
                          onClick={() => handleAutoFillAllIntegratedPiecesForRow(rowIndex)}
                          className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white font-bold text-[10px] rounded-md shadow-xs transition-all"
                          title="Gera peças 2 a 7 para Empeno, Curv. Central e Curv. Lateral nesta hora"
                        >
                          <Sparkles size={11} className="stroke-[2.5]" />
                          <span>Auto Pçs 2 a 7</span>
                        </button>
                      )}

                      {!isLocked && (
                        <>
                          <button 
                            type="button"
                            onClick={() => handleClearIntegratedRowPieces(rowIndex, 'all')}
                            className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-red-50 text-neutral-700 hover:text-red-600 border border-neutral-200 hover:border-red-200 text-[10px] font-bold rounded-md active:scale-95 transition-all"
                            title="Apagar medidas de todas as 7 peças nesta medição"
                          >
                            <Eraser size={11} className="text-red-500" />
                            <span>Apagar 7</span>
                          </button>

                          {isLiderMatriz2 && (
                            <button 
                              type="button"
                              onClick={() => handleClearIntegratedRowPieces(rowIndex, '2to7')}
                              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-amber-50 text-neutral-700 hover:text-amber-800 border border-neutral-200 hover:border-amber-300 text-[10px] font-bold rounded-md active:scale-95 transition-all"
                              title="Apagar apenas peças 2 a 7 geradas"
                            >
                              <RotateCcw size={11} className="text-amber-600" />
                              <span>Apagar 2-7</span>
                            </button>
                          )}

                          <button 
                            type="button"
                            onClick={() => handleRemoveIntegratedMeasurement(rowIndex)}
                            className="text-neutral-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                            title="Excluir horário de medição"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Seletor de Peça (Pç 1 a 7) - Sempre visível para facilitar a navegação rápida */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 hide-scrollbar">
                    <span className="text-[11px] font-bold text-neutral-500 mr-1 whitespace-nowrap">Peças:</span>
                    {[0, 1, 2, 3, 4, 5, 6].map((pIdx) => {
                      const pWarp = getPieceMax('warp', rowIndex, pIdx);
                      const pCC = getPieceMax('centralCurvature', rowIndex, pIdx);
                      const pCL = getPieceMax('lateralCurvature', rowIndex, pIdx);
                      const hasData = pWarp > 0 || pCC > 0 || pCL > 0;
                      const isSelected = integratedViewMode === 'focus' && selectedIntegratedPiece === pIdx;

                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            setSelectedIntegratedPiece(pIdx);
                            setIntegratedViewMode('focus');
                          }}
                          className={clsx(
                            "px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 border",
                            isSelected
                              ? "bg-neutral-900 text-white border-neutral-900 shadow-xs scale-102"
                              : hasData
                              ? "bg-white text-neutral-800 border-neutral-300 hover:border-neutral-400"
                              : "bg-white/60 text-neutral-400 border-neutral-200 hover:bg-white"
                          )}
                        >
                          <span>Pç {pIdx + 1}</span>
                          {hasData && (
                            <span className={clsx(
                              "w-1.5 h-1.5 rounded-full",
                              isSelected ? "bg-orange-400" : "bg-emerald-500"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Conteúdo: Modo Foco (1 Peça com Navegação) vs Modo Grade Completa (7 Peças) */}
                  {integratedViewMode === 'focus' ? (
                    <div className="space-y-2">
                      {renderPieceIntegratedTable(rowIndex, selectedIntegratedPiece)}

                      {/* Botões de Avanço Rápido de Peça */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedIntegratedPiece(prev => Math.max(0, prev - 1))}
                          disabled={selectedIntegratedPiece === 0}
                          className="px-3 py-1.5 bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none text-neutral-700 font-bold text-xs rounded-lg border border-neutral-200 shadow-2xs active:scale-95 transition-all flex items-center gap-1"
                        >
                          <ChevronLeft size={14} />
                          <span>Peça Anterior</span>
                        </button>

                        <span className="text-xs font-extrabold text-neutral-600 bg-neutral-200/80 px-2.5 py-1 rounded-md">
                          Peça {selectedIntegratedPiece + 1} de 7
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedIntegratedPiece(prev => Math.min(6, prev + 1))}
                          disabled={selectedIntegratedPiece === 6}
                          className="px-3 py-1.5 bg-neutral-900 hover:bg-black disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs rounded-lg shadow-xs active:scale-95 transition-all flex items-center gap-1"
                        >
                          <span>Próxima Peça</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Modo Grade: Todas as 7 Peças */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {[0, 1, 2, 3, 4, 5, 6].map((pIdx) => renderPieceIntegratedTable(rowIndex, pIdx))}
                    </div>
                  )}

                  {/* Rodapé da Medição Horária (Resumo dos 3 Maiores da Hora) */}
                  <div className="pt-2 border-t border-neutral-200 flex flex-wrap justify-between items-center text-xs gap-2 bg-white/80 p-2 rounded-lg">
                    <span className="font-bold text-neutral-500 text-[11px] uppercase tracking-wider">
                      MAIORES DA HORA ({currentTime}):
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-900 font-extrabold text-xs px-2 py-0.5 rounded border border-amber-300/80">
                        Empeno: <strong>{hourWarpMax}</strong>
                      </span>
                      <span className="bg-blue-100 text-blue-900 font-extrabold text-xs px-2 py-0.5 rounded border border-blue-300/80">
                        Curv. Central: <strong>{hourCCMax}</strong>
                      </span>
                      <span className="bg-emerald-100 text-emerald-900 font-extrabold text-xs px-2 py-0.5 rounded border border-emerald-300/80">
                        Curv. Lateral: <strong>{hourCLMax}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderLossesSection = () => {
    const losses = report.productionLosses || {
      granel: 0,
      granelUnit: 'paletes',
      caixasRasgadas: 0,
      repasses: 0,
      cacambaCaco: 0,
      notes: '',
      entries: []
    };

    const updateLosses = (updates: Partial<ProductionLosses>) => {
      if (isLocked) return;
      update({
        productionLosses: {
          ...losses,
          ...updates
        }
      });
    };

    const handleAdjustLoss = (field: 'granel' | 'caixasRasgadas' | 'repasses' | 'cacambaCaco', delta: number) => {
      if (isLocked) return;
      const currentVal = Number(losses[field]) || 0;
      const newVal = Math.max(0, currentVal + delta);
      updateLosses({ [field]: newVal });
    };

    const handleAddEntry = () => {
      if (isLocked) return;
      const qty = parseFloat(lossQuantity);
      if (isNaN(qty) || qty <= 0) return;

      const newEntry: ProductionLossEntry = {
        id: Date.now().toString(),
        time: lossTime,
        type: lossType,
        quantity: qty,
        observation: lossObs.trim() || undefined
      };

      const newEntries = [newEntry, ...(losses.entries || [])];
      const fieldMap: Record<typeof lossType, 'granel' | 'caixasRasgadas' | 'repasses' | 'cacambaCaco'> = {
        granel: 'granel',
        caixas_rasgadas: 'caixasRasgadas',
        repasses: 'repasses',
        cacamba_caco: 'cacambaCaco'
      };
      const field = fieldMap[lossType];
      const currentVal = Number(losses[field]) || 0;

      updateLosses({
        [field]: currentVal + qty,
        entries: newEntries
      });

      setLossQuantity('');
      setLossObs('');
    };

    const handleRemoveEntry = (entryId: string) => {
      if (isLocked) return;
      const entryToRemove = losses.entries?.find(e => e.id === entryId);
      if (!entryToRemove) return;

      const newEntries = (losses.entries || []).filter(e => e.id !== entryId);
      const fieldMap: Record<string, 'granel' | 'caixasRasgadas' | 'repasses' | 'cacambaCaco'> = {
        granel: 'granel',
        caixas_rasgadas: 'caixasRasgadas',
        repasses: 'repasses',
        cacamba_caco: 'cacambaCaco'
      };
      const field = fieldMap[entryToRemove.type];
      const currentVal = Number(losses[field]) || 0;
      const newVal = Math.max(0, currentVal - entryToRemove.quantity);

      updateLosses({
        [field]: newVal,
        entries: newEntries
      });
    };

    const handleClearAll = () => {
      if (isLocked) return;
      if (!confirm('Deseja zerar as quantidades de Granel, Caixas Rasgadas, Repasses e Caçamba de Caco?')) return;
      updateLosses({
        granel: 0,
        caixasRasgadas: 0,
        repasses: 0,
        cacambaCaco: 0,
        notes: '',
        entries: []
      });
    };

    const typeLabels: Record<string, { label: string; unit: string; color: string }> = {
      granel: { label: 'Granel', unit: losses.granelUnit || 'paletes', color: 'bg-amber-100 text-amber-900 border-amber-300' },
      caixas_rasgadas: { label: 'Caixas Rasgadas', unit: 'cx', color: 'bg-rose-100 text-rose-900 border-rose-300' },
      repasses: { label: 'Repasses', unit: 'pç/cx', color: 'bg-blue-100 text-blue-900 border-blue-300' },
      cacamba_caco: { label: 'Caçamba de Caco', unit: 'caçambas', color: 'bg-purple-100 text-purple-900 border-purple-300' },
    };

    return (
      <div className="space-y-3 w-full max-w-5xl mx-auto">
        {/* Cabeçalho */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-neutral-200">
          <div className="flex flex-wrap justify-between items-center gap-2 pb-2.5 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs">
                  <Boxes size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-800">Controle de Granel, Caixas Rasgadas, Repasses e Caco</h2>
                  <p className="text-[11px] text-neutral-500">Apontamento das quantidades de descartes, refugo e repasses do turno</p>
                </div>
              </div>
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 active:scale-95 transition-all shadow-2xs"
                title="Zerar todos os contadores desta aba"
              >
                <Eraser size={12} className="mr-1 text-red-500" /> Zerar Dados
              </button>
            )}
          </div>

          {/* 4 Cards Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {/* 1. GRANEL */}
            <div className="bg-gradient-to-b from-amber-50/60 to-white p-3 rounded-xl border border-amber-200/90 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded-md bg-amber-100 text-amber-800">
                      <Package size={15} />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-neutral-800 block leading-tight">Granel</span>
                      <span className="text-[9px] text-amber-700 font-semibold leading-none">Nº de Paletes</span>
                    </div>
                  </div>
                  {/* Seletor de unidade */}
                  <select
                    value={losses.granelUnit || 'paletes'}
                    onChange={(e) => updateLosses({ granelUnit: e.target.value })}
                    disabled={isLocked}
                    className="text-[10px] font-bold bg-white border border-amber-300 text-amber-900 rounded px-1.5 py-0.5 outline-none"
                    title="Unidade do Granel"
                  >
                    <option value="paletes">paletes</option>
                    <option value="m²">m²</option>
                    <option value="cx">cx</option>
                    <option value="pç">pç</option>
                  </select>
                </div>

                {/* Valor Principal */}
                <div className="my-2">
                  <input
                    type="number"
                    step="any"
                    value={losses.granel === 0 ? '' : losses.granel}
                    onChange={(e) => updateLosses({ granel: parseFloat(e.target.value) || 0 })}
                    disabled={isLocked}
                    placeholder="0"
                    className="w-full text-center text-2xl font-black text-amber-950 bg-white py-1 px-2 border-2 border-amber-300 rounded-lg focus:border-amber-500 outline-none shadow-inner"
                  />
                  <span className="block text-center text-[10px] font-semibold text-neutral-400 mt-1">
                    Número de {losses.granelUnit || 'paletes'}
                  </span>
                </div>
              </div>

              {/* Botões Rápidos */}
              {!isLocked && (
                <div className="flex items-center justify-center gap-1 pt-2 border-t border-amber-100 mt-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('granel', -5)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded active:scale-95 transition-all"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('granel', -1)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded active:scale-95 transition-all"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('granel', 1)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded active:scale-95 transition-all"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('granel', 2)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded active:scale-95 transition-all"
                  >
                    +2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('granel', 5)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-amber-700 hover:bg-amber-800 text-white rounded active:scale-95 transition-all"
                  >
                    +5
                  </button>
                </div>
              )}
            </div>

            {/* 2. CAIXAS RASGADAS */}
            <div className="bg-gradient-to-b from-rose-50/60 to-white p-3 rounded-xl border border-rose-200/90 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded-md bg-rose-100 text-rose-800">
                      <PackageX size={15} />
                    </div>
                    <span className="font-bold text-xs text-neutral-800">Caixas Rasgadas</span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                    cx
                  </span>
                </div>

                {/* Valor Principal */}
                <div className="my-2">
                  <input
                    type="number"
                    step="any"
                    value={losses.caixasRasgadas === 0 ? '' : losses.caixasRasgadas}
                    onChange={(e) => updateLosses({ caixasRasgadas: parseFloat(e.target.value) || 0 })}
                    disabled={isLocked}
                    placeholder="0"
                    className="w-full text-center text-2xl font-black text-rose-950 bg-white py-1 px-2 border-2 border-rose-300 rounded-lg focus:border-rose-500 outline-none shadow-inner"
                  />
                  <span className="block text-center text-[10px] font-semibold text-neutral-400 mt-1">
                    Total em caixas
                  </span>
                </div>
              </div>

              {/* Botões Rápidos */}
              {!isLocked && (
                <div className="flex items-center justify-center gap-1 pt-2 border-t border-rose-100 mt-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('caixasRasgadas', -1)}
                    className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded active:scale-95 transition-all"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('caixasRasgadas', 1)}
                    className="px-2 py-1 text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white rounded active:scale-95 transition-all"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('caixasRasgadas', 2)}
                    className="px-2 py-1 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded active:scale-95 transition-all"
                  >
                    +2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('caixasRasgadas', 5)}
                    className="px-2 py-1 text-[10px] font-bold bg-rose-700 hover:bg-rose-800 text-white rounded active:scale-95 transition-all"
                  >
                    +5
                  </button>
                </div>
              )}
            </div>

            {/* 3. REPASSES */}
            <div className="bg-gradient-to-b from-blue-50/60 to-white p-3 rounded-xl border border-blue-200/90 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded-md bg-blue-100 text-blue-800">
                      <RotateCcw size={15} />
                    </div>
                    <span className="font-bold text-xs text-neutral-800">Repasses</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    qtd
                  </span>
                </div>

                {/* Valor Principal */}
                <div className="my-2">
                  <input
                    type="number"
                    step="any"
                    value={losses.repasses === 0 ? '' : losses.repasses}
                    onChange={(e) => updateLosses({ repasses: parseFloat(e.target.value) || 0 })}
                    disabled={isLocked}
                    placeholder="0"
                    className="w-full text-center text-2xl font-black text-blue-950 bg-white py-1 px-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 outline-none shadow-inner"
                  />
                  <span className="block text-center text-[10px] font-semibold text-neutral-400 mt-1">
                    Peças / caixas reclassificadas
                  </span>
                </div>
              </div>

              {/* Botões Rápidos */}
              {!isLocked && (
                <div className="flex items-center justify-center gap-1 pt-2 border-t border-blue-100 mt-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('repasses', -5)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded active:scale-95 transition-all"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('repasses', -1)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded active:scale-95 transition-all"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('repasses', 1)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-blue-500 hover:bg-blue-600 text-white rounded active:scale-95 transition-all"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('repasses', 5)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded active:scale-95 transition-all"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('repasses', 10)}
                    className="px-1.5 py-1 text-[10px] font-bold bg-blue-700 hover:bg-blue-800 text-white rounded active:scale-95 transition-all"
                  >
                    +10
                  </button>
                </div>
              )}
            </div>

            {/* 4. CAÇAMBA DE CACO */}
            <div className="bg-gradient-to-b from-purple-50/60 to-white p-3 rounded-xl border border-purple-200/90 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded-md bg-purple-100 text-purple-800">
                      <Truck size={15} />
                    </div>
                    <span className="font-bold text-xs text-neutral-800">Caçamba de Caco</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                    caçamba
                  </span>
                </div>

                {/* Valor Principal */}
                <div className="my-2">
                  <input
                    type="number"
                    step="any"
                    value={losses.cacambaCaco === 0 ? '' : losses.cacambaCaco}
                    onChange={(e) => updateLosses({ cacambaCaco: parseFloat(e.target.value) || 0 })}
                    disabled={isLocked}
                    placeholder="0"
                    className="w-full text-center text-2xl font-black text-purple-950 bg-white py-1 px-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 outline-none shadow-inner"
                  />
                  <span className="block text-center text-[10px] font-semibold text-neutral-400 mt-1">
                    Número de caçambas
                  </span>
                </div>
              </div>

              {/* Botões Rápidos */}
              {!isLocked && (
                <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-purple-100 mt-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('cacambaCaco', -1)}
                    className="flex-1 py-1 text-[10px] font-bold bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded active:scale-95 transition-all"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('cacambaCaco', 1)}
                    className="flex-1 py-1 text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded active:scale-95 transition-all"
                  >
                    +1 Caçamba
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustLoss('cacambaCaco', 2)}
                    className="px-2 py-1 text-[10px] font-bold bg-purple-800 hover:bg-purple-900 text-white rounded active:scale-95 transition-all"
                  >
                    +2
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Observação Geral */}
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
              Observações sobre Descartes, Perdas ou Repasses (Opcional):
            </label>
            <textarea
              rows={2}
              value={losses.notes || ''}
              onChange={(e) => updateLosses({ notes: e.target.value })}
              disabled={isLocked}
              placeholder="Ex: Refugo gerado durante regulagem de taratura e troca de punção da Prensa..."
              className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs outline-none focus:bg-white focus:border-orange-500"
            />
          </div>
        </div>

        {/* Lançamento Horário Opcional */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-neutral-200">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-neutral-100">
            <div>
              <h3 className="text-xs font-bold text-neutral-800">Apontamento por Horário (Opcional)</h3>
              <p className="text-[10px] text-neutral-500">Se preferir ir lançando as ocorrências durante o turno, registre aqui e o total será somado automaticamente.</p>
            </div>
            <span className="text-[11px] font-bold text-neutral-500">
              {(losses.entries || []).length} lançamentos
            </span>
          </div>

          {!isLocked && (
            <div className="bg-neutral-50/80 p-2.5 rounded-lg border border-neutral-200 mb-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Horário</label>
                  <TimeInput
                    value={lossTime}
                    onChange={(newTime) => setLossTime(newTime)}
                    shift={report.shift}
                    className="py-1 px-1.5 text-xs font-bold"
                    label="Horário do apontamento"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Item</label>
                  <select
                    value={lossType}
                    onChange={(e) => setLossType(e.target.value as any)}
                    className="w-full py-1.5 px-2 bg-white border border-neutral-300 rounded text-xs font-semibold outline-none focus:border-orange-500"
                  >
                    <option value="granel">Granel</option>
                    <option value="caixas_rasgadas">Caixas Rasgadas</option>
                    <option value="repasses">Repasses</option>
                    <option value="cacamba_caco">Caçamba de Caco</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Quantidade</label>
                  <input
                    type="number"
                    step="any"
                    value={lossQuantity}
                    onChange={(e) => setLossQuantity(e.target.value)}
                    placeholder="Qtd"
                    className="w-full py-1.5 px-2 bg-white border border-neutral-300 rounded text-xs font-bold text-center outline-none focus:border-orange-500"
                  />
                </div>

                <div className="sm:col-span-3 flex gap-1">
                  <button
                    type="button"
                    onClick={handleAddEntry}
                    disabled={!lossQuantity || parseFloat(lossQuantity) <= 0}
                    className="w-full py-1.5 bg-neutral-900 hover:bg-black disabled:bg-neutral-300 text-white text-xs font-bold rounded flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                  >
                    <Plus size={13} className="text-orange-400" />
                    <span>Lançar</span>
                  </button>
                </div>
              </div>

              <div className="mt-1.5">
                <input
                  type="text"
                  value={lossObs}
                  onChange={(e) => setLossObs(e.target.value)}
                  placeholder="Observação deste lançamento (opcional, ex: queda na esteira, troca de palete...)"
                  className="w-full py-1 px-2 bg-white border border-neutral-200 rounded text-xs outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* Histórico dos Lançamentos */}
          {(losses.entries || []).length === 0 ? (
            <p className="text-center text-neutral-400 text-xs py-2 bg-neutral-50 rounded-lg">
              Nenhum apontamento horário registrado. As quantidades principais acima já são suficientes.
            </p>
          ) : (
            <div className="space-y-1.5">
              {(losses.entries || []).map((entry) => {
                const meta = typeLabels[entry.type] || { label: entry.type, unit: '', color: 'bg-neutral-100 text-neutral-800' };
                return (
                  <div key={entry.id} className="flex items-center justify-between p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-600 bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-[11px]">
                        <Clock size={11} className="inline mr-1 text-orange-500" />
                        {entry.time}
                      </span>
                      <span className={clsx("font-bold text-[10px] px-1.5 py-0.5 rounded border", meta.color)}>
                        {meta.label}
                      </span>
                      <span className="font-black text-neutral-900">
                        +{entry.quantity} {meta.unit}
                      </span>
                      {entry.observation && (
                        <span className="text-[11px] text-neutral-500 truncate max-w-xs">
                          • {entry.observation}
                        </span>
                      )}
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(entry.id)}
                        className="text-neutral-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                        title="Remover este apontamento (subtrai do total)"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100">
      {/* Header Compacto */}
      <header className="bg-white border-b border-neutral-200 px-3 py-1.5 flex items-center justify-between shadow-2xs z-30 sticky top-0">
        <div className="flex items-center gap-1.5 min-w-0 mr-2">
          <Link to="/" className="p-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg active:scale-95 flex-shrink-0" title="Voltar ao início">
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-neutral-800 truncate">
                {isFinalized ? (isEditingFinalized ? 'Editando Relatório' : 'Relatório Finalizado') : 'Preencher Relatório'}
              </h1>
              {isFinalized && (
                <span className={clsx(
                  "text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded",
                  isEditingFinalized ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-neutral-900 text-white"
                )}>
                  {isEditingFinalized ? 'Edição' : 'Finalizado'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-500 truncate">
              {isFinalized && isEditingFinalized 
                ? 'Edição habilitada • As alterações serão salvas' 
                : 'Salvo localmente • Envio sob demanda'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Botão de alternar Edição em Relatório Finalizado */}
          {isFinalized && (
            <button
              type="button"
              onClick={() => setIsEditingFinalized(!isEditingFinalized)}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold shadow-xs active:scale-95 transition-all",
                isEditingFinalized
                  ? "bg-amber-500 hover:bg-amber-600 text-white border border-amber-600"
                  : "bg-neutral-900 hover:bg-black text-white"
              )}
              title={isEditingFinalized ? "Clique para concluir ou pausar a edição" : "Clique para habilitar a edição deste relatório"}
            >
              <Pencil size={11} className={isEditingFinalized ? "text-amber-100" : "text-orange-400"} />
              <span>{isEditingFinalized ? 'Concluir' : 'Editar'}</span>
            </button>
          )}

          {!isLocked && (
            <button
              onClick={handleSendToCloud}
              disabled={isSyncing}
              className={clsx(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-xs active:scale-95 transition-all",
                report.syncStatus === 'pending'
                  ? "bg-orange-500 hover:bg-orange-600 text-white animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
              title="Aperte para enviar os dados deste relatório para a nuvem"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={11} className="animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : report.syncStatus === 'pending' ? (
                <>
                  <UploadCloud size={12} />
                  <span>Enviar</span>
                </>
              ) : (
                <>
                  <Check size={11} className="stroke-[3]" />
                  <span>Nuvem OK</span>
                </>
              )}
            </button>
          )}
          <CloudSyncBadge showLabel={false} />
        </div>
      </header>

      {syncFeedback && (
        <div className="bg-neutral-900 text-white text-[11px] font-medium py-1 px-3 text-center sticky top-[41px] z-20 shadow-xs">
          {syncFeedback}
        </div>
      )}

      {/* Banner informativo de modo de edição para relatório finalizado */}
      {isFinalized && isEditingFinalized && (
        <div className="bg-amber-500 text-white text-[11px] font-bold py-1 px-3 flex flex-wrap items-center justify-between gap-1.5 sticky top-[41px] z-20 shadow-xs">
          <div className="flex items-center gap-1.5">
            <Pencil size={12} className="stroke-[2.5]" />
            <span>Modo de Edição Ativo: altere medições e defeitos livremente.</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSaveAndRegeneratePDF}
              className="bg-white text-amber-900 px-2 py-0.5 rounded text-[10px] font-black hover:bg-amber-50 active:scale-95 transition-all shadow-2xs"
            >
              Salvar PDF
            </button>
            <button
              type="button"
              onClick={() => setIsEditingFinalized(false)}
              className="bg-amber-700 hover:bg-amber-800 text-white px-2 py-0.5 rounded text-[10px] font-semibold active:scale-95 transition-all"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {isFinalized && !isEditingFinalized && (
        <div className="bg-neutral-800 text-neutral-200 text-[11px] font-medium py-1 px-3 flex items-center justify-between sticky top-[41px] z-20 shadow-xs">
          <span>Relatório finalizado em modo somente leitura.</span>
          <button
            type="button"
            onClick={() => setIsEditingFinalized(true)}
            className="text-orange-400 hover:text-orange-300 font-bold underline flex items-center gap-1 active:scale-95 text-[11px]"
          >
            <Pencil size={11} /> Habilitar Edição
          </button>
        </div>
      )}

      {/* Tabs Slim */}
      <div className="bg-white border-b border-neutral-200 overflow-x-auto hide-scrollbar sticky top-[41px] z-10">
        <div className="flex px-1.5 py-1 w-max gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-colors",
                activeTab === tab.id ? "bg-neutral-900 text-white shadow-xs" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 pb-8">
        
        {/* TAB 1: IDENTIFICATION */}
        {activeTab === 'info' && (
          <div className="space-y-2.5 w-full max-w-4xl mx-auto">
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-neutral-200">
              <h2 className="text-sm font-bold mb-2 pb-1.5 border-b border-neutral-100 text-neutral-800">Identificação do Relatório</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-0.5">Data *</label>
                  <input 
                    type="date" 
                    value={report.date} 
                    onChange={e => update({ date: e.target.value })}
                    disabled={isLocked}
                    className="w-full py-1.5 px-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-0.5">Turno *</label>
                  <div className="flex gap-1">
                    {['A', 'B', 'C', 'D'].map(shift => (
                      <button
                        key={shift}
                        onClick={() => update({ shift })}
                        disabled={isLocked}
                        className={clsx(
                          "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                          report.shift === shift ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                        )}
                      >
                        {shift}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                  <div className="text-[11px] text-neutral-600">
                    <span className="font-bold text-neutral-800">Horários Turno {report.shift}:</span>{' '}
                    {(SHIFT_HOURS[report.shift] || []).join(' • ')}
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleDefineShiftHours(report.shift)}
                      className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1 whitespace-nowrap ml-2"
                      title="Definir os horários deste turno em todas as seções"
                    >
                      <Clock size={11} />
                      <span>Definir Horários</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-0.5">Linha *</label>
                  <input 
                    type="text" 
                    value={report.line} 
                    onChange={e => update({ line: e.target.value })}
                    disabled={isLocked}
                    className="w-full py-1.5 px-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none"
                    placeholder="Ex: Linha 1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-0.5">Formato</label>
                  <input 
                    type="text" 
                    value={report.format} 
                    onChange={e => update({ format: e.target.value })}
                    disabled={isLocked}
                    className="w-full py-1.5 px-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none"
                    placeholder="Ex: 60x60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-0.5">Referência</label>
                  <input 
                    type="text" 
                    value={report.reference} 
                    onChange={e => update({ reference: e.target.value })}
                    disabled={isLocked}
                    className="w-full py-1.5 px-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none"
                    placeholder="Código do produto atual"
                  />
                </div>

                {/* SEÇÃO: TROCA COM ESPAÇO PARA REFERÊNCIA DO PRODUTO NOVO */}
                <div className="sm:col-span-2 mt-1 pt-3 border-t border-neutral-200">
                  <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white p-3 rounded-xl border-2 border-amber-300 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-amber-200">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-amber-600 text-white flex items-center justify-center shadow-2xs">
                          <RotateCcw size={13} />
                        </div>
                        <div>
                          <span className="font-black text-xs text-amber-950 uppercase tracking-wide">Troca</span>
                          <span className="text-[11px] text-amber-800 ml-1.5 font-medium">Troca de produto no turno</span>
                        </div>
                      </div>
                      {report.productChange?.newReference ? (
                        <span className="text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={11} className="stroke-[3]" /> Troca Informada
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 italic">
                          (Preencha se houver troca de produto durante o turno)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-6">
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Referência do Produto Novo: *
                        </label>
                        <input 
                          type="text" 
                          value={report.productChange?.newReference || ''} 
                          onChange={e => update({ 
                            productChange: {
                              ...(report.productChange || {}),
                              hasChange: Boolean(e.target.value.trim()),
                              newReference: e.target.value
                            } 
                          })}
                          disabled={isLocked}
                          className="w-full py-2 px-3 bg-white border-2 border-amber-400 rounded-lg text-xs font-bold text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal focus:border-amber-600 focus:ring-2 focus:ring-amber-200 outline-none shadow-xs"
                          placeholder="Digite a referência do produto novo..."
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Horário da Troca
                        </label>
                        <TimeInput
                          value={report.productChange?.time || ''}
                          onChange={(newTime) => update({
                            productChange: {
                              ...(report.productChange || { newReference: '' }),
                              time: newTime
                            }
                          })}
                          disabled={isLocked}
                          shift={report.shift}
                          className="py-1.5 px-2 text-xs font-bold"
                          label="Horário da Troca"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Formato Novo
                        </label>
                        <input 
                          type="text" 
                          value={report.productChange?.newFormat || ''} 
                          onChange={e => update({ 
                            productChange: {
                              ...(report.productChange || { newReference: '' }),
                              newFormat: e.target.value
                            } 
                          })}
                          disabled={isLocked}
                          className="w-full py-2 px-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium focus:border-amber-500 outline-none"
                          placeholder="Ex: 60x60"
                        />
                      </div>

                      <div className="sm:col-span-12">
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">
                          Observação da Troca (Opcional):
                        </label>
                        <input 
                          type="text" 
                          value={report.productChange?.observation || ''} 
                          onChange={e => update({ 
                            productChange: {
                              ...(report.productChange || { newReference: '' }),
                              observation: e.target.value
                            } 
                          })}
                          disabled={isLocked}
                          className="w-full py-1.5 px-2.5 bg-white border border-neutral-200 rounded-lg text-xs outline-none focus:border-amber-500 placeholder:text-neutral-400"
                          placeholder="Ex: Início da produção da referência nova, troca de punção realizada..."
                        />
                      </div>
                    </div>

                    {report.productChange?.newReference && (
                      <div className="mt-2.5 pt-2 border-t border-amber-200 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                        <span className="text-amber-950 font-medium">
                          Produto Novo Registrado: <strong className="font-black text-amber-900">{report.productChange.newReference}</strong>
                          {report.productChange.time && <span className="text-amber-800"> às {report.productChange.time}</span>}
                          {report.productChange.newFormat && <span className="text-neutral-600"> ({report.productChange.newFormat})</span>}
                        </span>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => update({
                              productChange: {
                                hasChange: false,
                                newReference: '',
                                time: '',
                                newFormat: '',
                                observation: ''
                              }
                            })}
                            className="text-neutral-500 hover:text-red-600 text-[11px] font-semibold underline flex items-center gap-1 active:scale-95"
                          >
                            <Eraser size={11} /> Limpar Troca
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setActiveTab('thickness')}
                className="w-full mt-3 flex items-center justify-center py-2 bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold rounded-lg active:scale-95 transition-all"
              >
                Avançar para Espessura <ArrowRight size={14} className="ml-1.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: THICKNESS (3 PEÇAS POR HORA) */}
        {activeTab === 'thickness' && (
          <div className="space-y-2.5 w-full max-w-6xl mx-auto">
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-neutral-200">
              <div className="flex flex-wrap justify-between items-center gap-1.5 mb-2.5 pb-2 border-b border-neutral-100">
                <div>
                  <h2 className="text-sm font-bold text-neutral-800">Controle de Espessura</h2>
                  <p className="text-[11px] text-neutral-500">3 peças medidas por hora • 4 lados cada (L1-L4 em mm)</p>
                </div>

                {!isLocked && (
                  <div className="flex flex-wrap items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => handleDefineShiftHoursForSection('thickness')}
                      className="flex items-center text-[11px] font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded-md border border-neutral-200 active:scale-95 transition-all"
                      title="Definir as 8 horas do turno"
                    >
                      <Clock size={12} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
                    </button>
                    {isLiderMatriz2 && report.thickness.length > 0 && (
                      <button 
                        type="button"
                        onClick={handleAutoFillAllThicknessPieces}
                        className="flex items-center text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-300 active:scale-95 transition-all shadow-xs"
                        title="Preenche as peças 2 e 3 em todas as medições que tenham a Peça 1 preenchida"
                      >
                        <Sparkles size={12} className="mr-1 text-amber-600 stroke-[2.5]" /> Auto Pçs 2-3 em Todas
                      </button>
                    )}
                    {report.thickness.length > 0 && (
                      <button 
                        type="button"
                        onClick={handleClearAllThicknessPieces}
                        className="flex items-center text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md border border-red-200 active:scale-95 transition-all"
                        title="Apagar os valores das 3 peças em todas as medições de espessura"
                      >
                        <Eraser size={12} className="mr-1 text-red-500" /> Apagar 3 Peças (Todas)
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const nextTime = getNextShiftHour(report.thickness.map(t => t.time), report.shift);
                        update({ 
                          thickness: [
                            ...report.thickness, 
                            { 
                              time: nextTime, 
                              cv: 'A', 
                              l1: 0, 
                              l2: 0, 
                              l3: 0, 
                              l4: 0,
                              pc1: 0,
                              pc1_s: [0, 0, 0, 0],
                              pc2: 0,
                              pc2_s: [0, 0, 0, 0],
                              pc3: 0,
                              pc3_s: [0, 0, 0, 0]
                            }
                          ] 
                        });
                      }}
                      className="flex items-center text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-md border border-orange-200 active:scale-95 transition-all"
                    >
                      <Plus size={13} className="mr-1" /> Adicionar
                    </button>
                  </div>
                )}
              </div>

              {report.thickness.length === 0 ? (
                <p className="text-neutral-500 text-center py-4 text-xs bg-neutral-50 rounded-lg border border-dashed border-neutral-200">Nenhuma medição registrada.</p>
              ) : (
                <div className="space-y-2.5">
                  {report.thickness.map((item, index) => {
                    const p1Val = getThicknessVal(item, 'pc1');
                    const p2Val = getThicknessVal(item, 'pc2');
                    const p3Val = getThicknessVal(item, 'pc3');
                    const activePcs = [p1Val, p2Val, p3Val].filter(v => v > 0);
                    const horaAvg = activePcs.length > 0 
                      ? Math.round((activePcs.reduce((a, b) => a + b, 0) / activePcs.length) * 10) / 10 
                      : 0;

                    return (
                      <div key={index} className="p-2 sm:p-2.5 border border-neutral-200 rounded-lg bg-neutral-50/80">
                        {/* Header da Medição */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5 bg-white p-1.5 rounded-lg border border-neutral-200">
                          <div className="flex items-center gap-2">
                            <div className="w-28 sm:w-32">
                              <TimeInput 
                                value={item.time}
                                onChange={(newTime) => {
                                  const newThick = [...report.thickness];
                                  newThick[index].time = newTime;
                                  update({ thickness: newThick });
                                }}
                                disabled={isLocked}
                                shift={report.shift}
                                className="py-1 px-1.5 text-xs font-bold"
                                label={`Medição ${index + 1} - Espessura`}
                              />
                            </div>

                            {/* Classificação C/V */}
                            <div className="flex items-center gap-0.5 bg-neutral-100 p-0.5 rounded-md border border-neutral-200">
                              <span className="text-[10px] font-bold text-neutral-500 px-1">C/V:</span>
                              {(['A', 'AR', 'R'] as const).map(status => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => {
                                    const newThick = [...report.thickness];
                                    newThick[index].cv = status;
                                    update({ thickness: newThick });
                                  }}
                                  disabled={isLocked}
                                  className={clsx(
                                    "px-1.5 py-0.5 text-[11px] font-bold rounded transition-all",
                                    item.cv === status 
                                      ? (status === 'R' ? 'bg-red-500 text-white shadow-2xs' : status === 'AR' ? 'bg-orange-500 text-white shadow-2xs' : 'bg-neutral-900 text-white shadow-2xs') 
                                      : 'text-neutral-600 hover:bg-neutral-200'
                                  )}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Botões de Ação na Linha */}
                          <div className="flex flex-wrap items-center gap-1">
                            {isLiderMatriz2 && !isLocked && (
                              <button 
                                type="button"
                                onClick={() => handleAutoFillThicknessPieces(index)}
                                className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white font-bold text-[10px] rounded-md shadow-xs transition-all"
                                title="Preenche as peças 2 e 3 automaticamente com números próximos aos da Peça 1"
                              >
                                <Sparkles size={11} className="stroke-[2.5]" />
                                <span>Gerar Pçs 2 e 3</span>
                              </button>
                            )}

                            {!isLocked && (
                              <>
                                <button 
                                  type="button"
                                  onClick={() => handleClearThicknessRowPieces(index, 'all')}
                                  className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-red-50 text-neutral-700 hover:text-red-600 border border-neutral-200 hover:border-red-200 text-[10px] font-bold rounded-md active:scale-95 transition-all"
                                  title="Apagar os valores das 3 peças desta medição"
                                >
                                  <Eraser size={11} className="text-red-500" />
                                  <span>Apagar 3</span>
                                </button>

                                {isLiderMatriz2 && (
                                  <button 
                                    type="button"
                                    onClick={() => handleClearThicknessRowPieces(index, '2to3')}
                                    className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-amber-50 text-neutral-700 hover:text-amber-800 border border-neutral-200 hover:border-amber-300 text-[10px] font-bold rounded-md active:scale-95 transition-all"
                                    title="Apagar apenas as peças 2 e 3 geradas"
                                  >
                                    <RotateCcw size={11} className="text-amber-600" />
                                    <span>Apagar 2-3</span>
                                  </button>
                                )}

                                <button 
                                  onClick={() => {
                                    const newThick = [...report.thickness];
                                    newThick.splice(index, 1);
                                    update({ thickness: newThick });
                                  }}
                                  className="text-neutral-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                                  title="Excluir medição"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* As 3 Peças */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {(['pc1', 'pc2', 'pc3'] as const).map((col, pcIdx) => {
                            const sides = getThicknessSides(item, col);
                            const pcVal = getThicknessVal(item, col);

                            return (
                              <div key={col} className="bg-white p-1.5 rounded-md border border-neutral-200 shadow-2xs flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px] font-bold text-neutral-800">Peça {pcIdx + 1}</span>
                                    {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => handleClearSingleThicknessPiece(index, col)}
                                        className="text-[9px] font-medium text-neutral-400 hover:text-red-600 hover:bg-red-50 px-1 py-0.2 rounded flex items-center gap-0.5 active:scale-95 transition-all"
                                        title={`Apagar medidas da Peça ${pcIdx + 1}`}
                                      >
                                        <Eraser size={9} className="text-neutral-400 hover:text-red-500" />
                                      </button>
                                    )}
                                    {isLiderMatriz2 && !isLocked && pcIdx === 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleAutoFillThicknessPieces(index)}
                                        className="text-[9px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1 py-0.2 rounded flex items-center gap-0.5 active:scale-95 transition-all"
                                        title="Preencher peças 2 e 3"
                                      >
                                        <Sparkles size={9} className="text-amber-600 stroke-[2.5]" />
                                        <span>2 e 3</span>
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-extrabold text-orange-800 bg-orange-100/90 px-1 py-0.2 rounded">
                                    {pcVal > 0 ? `${pcVal}mm` : '0.0'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-4 gap-1">
                                  {[0, 1, 2, 3].map(sideIdx => (
                                    <div key={sideIdx}>
                                      <label className="block text-center text-[9px] font-medium text-neutral-400 mb-0.5">L{sideIdx + 1}</label>
                                      <MeasurementInput
                                        value={sides[sideIdx]}
                                        onChange={(val) => {
                                          const newThick = [...report.thickness];
                                          const curItem = { ...newThick[index] };
                                          const curSides = [...getThicknessSides(curItem, col)];
                                          curSides[sideIdx] = val;
                                          curItem[`${col}_s`] = curSides;
                                          const valid = curSides.filter(v => (v || 0) > 0);
                                          const avg = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0;
                                          curItem[col] = avg;
                                          if (col === 'pc1') {
                                            curItem.l1 = curSides[0] || 0;
                                            curItem.l2 = curSides[1] || 0;
                                            curItem.l3 = curSides[2] || 0;
                                            curItem.l4 = curSides[3] || 0;
                                          }
                                          newThick[index] = curItem;
                                          update({ thickness: newThick });
                                        }}
                                        disabled={isLocked}
                                        placeholder="0"
                                        className="w-full py-0.5 px-0.5 text-center text-xs font-semibold border border-neutral-300 rounded bg-neutral-50 focus:bg-white focus:border-orange-500 outline-none"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Rodapé da Medição */}
                        <div className="mt-1.5 pt-1.5 border-t border-neutral-200/80 flex flex-wrap justify-between items-center text-xs gap-1">
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                            <span>Status C/V: <strong className="text-neutral-800">{item.cv || 'A'}</strong></span>
                            <span>•</span>
                            <span>Medidas: <strong className="text-neutral-800">{activePcs.length}/3</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-neutral-500 text-[11px]">MÉDIA DA HORA:</span>
                            <span className="font-black text-xs text-neutral-900 bg-neutral-200 px-2 py-0.5 rounded">
                              {horaAvg > 0 ? `${horaAvg.toFixed(1)} mm` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: EMPENO & CURVATURAS (JUNTAS) */}
        {activeTab === 'integrated' && renderIntegratedSection()}

        {/* TAB: PROCESSO */}
        {activeTab === 'process' && (
          <div className="space-y-2.5 w-full max-w-5xl mx-auto">
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-neutral-200">
              <div className="flex flex-wrap justify-between items-center gap-1.5 mb-2.5 pb-2 border-b border-neutral-100">
                <div>
                  <h2 className="text-sm font-bold text-neutral-800">Controle de Processo</h2>
                  <p className="text-[11px] text-neutral-500">Taratura, corte e lascamento por hora de produção</p>
                </div>
                {!isLocked && (
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => handleDefineShiftHoursForSection('process')}
                      className="flex items-center text-[11px] font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded-md border border-neutral-200 active:scale-95 transition-all"
                      title="Definir as 8 horas do turno"
                    >
                      <Clock size={12} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
                    </button>
                    <button 
                      onClick={() => {
                        const nextTime = getNextShiftHour((report.processChecks || []).map(t => t.time), report.shift);
                        update({ processChecks: [...(report.processChecks || []), { time: nextTime, taratura: '-', corte: '-', lascamento: '-' }] });
                      }}
                      className="flex items-center text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-md border border-orange-200 active:scale-95 transition-all"
                    >
                      <Plus size={13} className="mr-1" /> Adicionar
                    </button>
                  </div>
                )}
              </div>

              {(!report.processChecks || report.processChecks.length === 0) ? (
                <p className="text-neutral-500 text-center py-4 text-xs bg-neutral-50 rounded-lg border border-dashed border-neutral-200">Nenhum controle registrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {report.processChecks.map((item, index) => (
                    <div key={index} className="p-2 border border-neutral-200 rounded-lg bg-neutral-50/80 flex flex-wrap items-end justify-between gap-2">
                      <div className="flex flex-col gap-0.5 w-28 sm:w-32">
                        {!isLocked && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newList = [...report.processChecks];
                              newList.splice(index, 1);
                              update({ processChecks: newList });
                            }}
                            className="text-neutral-400 hover:text-red-500 p-0.5 hover:bg-red-50 rounded transition-colors self-start"
                            title="Remover verificação"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <TimeInput 
                          value={item.time}
                          onChange={(newTime) => {
                            const newList = [...report.processChecks];
                            newList[index].time = newTime;
                            update({ processChecks: newList });
                          }}
                          disabled={isLocked}
                          shift={report.shift}
                          className="py-1 px-1.5 text-xs font-bold"
                          label={`Verificação ${index + 1} - Processo`}
                        />
                      </div>
                      
                      <div className="flex-1 flex flex-wrap items-center gap-2 justify-end">
                        {(['taratura', 'corte', 'lascamento'] as const).map(field => (
                          <div key={field} className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-neutral-200">
                            <span className="text-[11px] font-semibold text-neutral-600 capitalize mr-1">{field}:</span>
                            <button
                              onClick={() => {
                                const newList = [...report.processChecks];
                                newList[index][field] = 'OK';
                                update({ processChecks: newList });
                              }}
                              disabled={isLocked}
                              className={clsx(
                                "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                                item[field] === 'OK' 
                                  ? "bg-neutral-900 text-white shadow-2xs" 
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                              )}
                            >
                              OK
                            </button>
                            <button
                              onClick={() => {
                                const newList = [...report.processChecks];
                                newList[index][field] = 'Ruim';
                                update({ processChecks: newList });
                              }}
                              disabled={isLocked}
                              className={clsx(
                                "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                                item[field] === 'Ruim' 
                                  ? "bg-red-500 text-white shadow-2xs" 
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                              )}
                            >
                              RUIM
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PESAGEM DA CAIXA */}
        {activeTab === 'weights' && (
          <div className="space-y-2.5 w-full max-w-5xl mx-auto">
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-neutral-200">
              <div className="flex flex-wrap justify-between items-center gap-1.5 mb-2.5 pb-2 border-b border-neutral-100">
                <div>
                  <h2 className="text-sm font-bold text-neutral-800">Pesagem da Caixa</h2>
                  <p className="text-[11px] text-neutral-500">Conferência de peso em kg por hora</p>
                </div>
                {!isLocked && (
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => handleDefineShiftHoursForSection('weights')}
                      className="flex items-center text-[11px] font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded-md border border-neutral-200 active:scale-95 transition-all"
                      title="Definir as 8 horas do turno"
                    >
                      <Clock size={12} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
                    </button>
                    <button 
                      onClick={() => {
                        const nextTime = getNextShiftHour((report.boxWeights || []).map(t => t.time), report.shift);
                        update({ boxWeights: [...(report.boxWeights || []), { time: nextTime, weight: 0 }] });
                      }}
                      className="flex items-center text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-md border border-orange-200 active:scale-95 transition-all"
                    >
                      <Plus size={13} className="mr-1" /> Adicionar
                    </button>
                  </div>
                )}
              </div>

              {(!report.boxWeights || report.boxWeights.length === 0) ? (
                <p className="text-neutral-500 text-center py-4 text-xs bg-neutral-50 rounded-lg border border-dashed border-neutral-200">Nenhuma pesagem registrada.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                  {report.boxWeights.map((item, index) => (
                    <div key={index} className="flex gap-2 p-1.5 border border-neutral-200 rounded-lg bg-neutral-50/80 items-center justify-between">
                      <div className="w-24">
                        <label className="block text-[9px] font-semibold text-neutral-400 mb-0.5">Hora</label>
                        <TimeInput 
                          value={item.time}
                          onChange={(newTime) => {
                            const newList = [...report.boxWeights];
                            newList[index].time = newTime;
                            update({ boxWeights: newList });
                          }}
                          disabled={isLocked}
                          shift={report.shift}
                          className="w-full py-0.5 px-1 text-xs font-bold"
                          label={`Pesagem ${index + 1}`}
                        />
                      </div>
                      <div className="flex-1 min-w-[70px]">
                        <label className="block text-[9px] font-semibold text-neutral-400 mb-0.5">Peso (kg)</label>
                        <MeasurementInput
                          value={item.weight}
                          onChange={(val) => {
                            const newList = [...report.boxWeights];
                            newList[index].weight = val;
                            update({ boxWeights: newList });
                          }}
                          disabled={isLocked}
                          placeholder="0.00"
                          className="w-full py-0.5 px-1 border border-neutral-300 rounded bg-white text-xs font-bold text-neutral-800 outline-none focus:border-orange-500 text-center"
                        />
                      </div>
                      {!isLocked && (
                        <button 
                          onClick={() => {
                            const newList = [...report.boxWeights];
                            newList.splice(index, 1);
                            update({ boxWeights: newList });
                          }}
                          className="text-neutral-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors self-end mb-0.5"
                          title="Excluir pesagem"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: GRANEL, CAIXAS RASGADAS, REPASSES E CAÇAMBA DE CACO */}
        {activeTab === 'losses' && renderLossesSection()}

        {/* TAB 4: DEFECTS */}
        {activeTab === 'defects' && (
          <div className="space-y-2.5 w-full max-w-4xl mx-auto">
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-neutral-200">
              <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-neutral-100">
                <h2 className="text-sm font-bold text-neutral-800">Registro Rápido de Defeitos</h2>
                <span className="text-[11px] font-semibold text-neutral-500">Total: {report.defects.reduce((acc, d) => acc + d.quantity, 0)} defeitos</span>
              </div>
              
              {!isLocked && (
                <div className="bg-neutral-50/80 p-2 rounded-lg border border-neutral-200 mb-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-semibold text-neutral-700 whitespace-nowrap">Horário:</label>
                    <div className="w-28">
                      <TimeInput 
                        value={defectTime}
                        onChange={(newTime) => setDefectTime(newTime)}
                        shift={report.shift}
                        className="py-1 px-1.5 text-xs font-bold"
                        label="Horário do lote de defeitos"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {defectEntries.map((entry, index) => (
                      <div key={index} className="p-2 bg-white border border-neutral-300 rounded-lg shadow-2xs">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-neutral-400">#{index + 1}</span>
                          {defectEntries.length > 1 && (
                            <button 
                              onClick={() => {
                                const newEntries = [...defectEntries];
                                newEntries.splice(index, 1);
                                setDefectEntries(newEntries);
                              }}
                              className="text-neutral-400 hover:text-red-500 p-0.5 ml-auto rounded"
                              title="Remover este item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                          <div className="sm:col-span-6">
                            <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">Defeito</label>
                            <select 
                              value={entry.id}
                              onChange={(e) => {
                                const newEntries = [...defectEntries];
                                newEntries[index].id = e.target.value;
                                setDefectEntries(newEntries);
                              }}
                              className="w-full py-1 px-2 bg-neutral-50 border border-neutral-200 rounded text-xs outline-none"
                            >
                              <option value="">Selecione...</option>
                              {DEFECTS_LIST.map(d => (
                                <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">Leitura Atual</label>
                            <input 
                              type="number" 
                              value={entry.amount}
                              onChange={(e) => {
                                const newEntries = [...defectEntries];
                                newEntries[index].amount = e.target.value;
                                setDefectEntries(newEntries);
                              }}
                              placeholder="Total Ex: 150"
                              className="w-full py-1 px-2 bg-neutral-50 border border-neutral-200 rounded text-xs" 
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">Observação</label>
                            <input 
                              type="text" 
                              value={entry.obs}
                              onChange={(e) => {
                                const newEntries = [...defectEntries];
                                newEntries[index].obs = e.target.value;
                                setDefectEntries(newEntries);
                              }}
                              className="w-full py-1 px-2 bg-neutral-50 border border-neutral-200 rounded text-xs" 
                              placeholder="Opcional" 
                            />
                          </div>
                        </div>

                        {entry.id && entry.amount && (() => {
                          const defectId = parseInt(entry.id);
                          const previousTotal = report.defects
                            .filter(d => d.defectId === defectId)
                            .reduce((sum, d) => sum + d.quantity, 0);
                          const inputTotal = parseInt(entry.amount) || 0;
                          const actualQuantity = inputTotal > previousTotal ? inputTotal - previousTotal : inputTotal;
                          
                          return (
                            <div className="text-[11px] px-1 text-orange-700 mt-1">
                              {previousTotal > 0 ? (
                                inputTotal > previousTotal ? (
                                  <span>Cálculo: {inputTotal} - {previousTotal} = <strong>{actualQuantity} nesta hora</strong>.</span>
                                ) : (
                                  <span className="text-orange-600">Aviso: Leitura menor que anterior. Será registrado <strong>{actualQuantity}</strong>.</span>
                                )
                              ) : (
                                <span>Primeiro registro: <strong>{actualQuantity}</strong>.</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                    
                    <div className="flex gap-1.5 pt-1">
                      <button 
                        onClick={() => setDefectEntries([...defectEntries, { id: '', amount: '', obs: '' }])}
                        className="flex-1 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-xs font-bold rounded-lg flex justify-center items-center active:scale-95 transition-all"
                      >
                        <Plus size={14} className="mr-1" /> Mais um Defeito
                      </button>

                      <button 
                        onClick={() => {
                          const newDefects = [...report.defects];
                          let added = false;
                          
                          defectEntries.forEach(entry => {
                            if (!entry.id || !entry.amount) return;
                            
                            const defectId = parseInt(entry.id);
                            const defectDef = DEFECTS_LIST.find(d => d.code === defectId);
                            
                            const previousTotal = report.defects
                              .filter(d => d.defectId === defectId)
                              .reduce((sum, d) => sum + d.quantity, 0);
                              
                            const inputTotal = parseInt(entry.amount) || 0;
                            const actualQuantity = inputTotal > previousTotal ? inputTotal - previousTotal : inputTotal;
                            
                            if (actualQuantity > 0) {
                              newDefects.push({
                                defectId,
                                name: defectDef?.name || '',
                                quantity: actualQuantity,
                                time: defectTime,
                                observation: entry.obs
                              });
                              added = true;
                            }
                          });
                          
                          if (added) {
                            update({ defects: newDefects });
                            setDefectEntries([{ id: '', amount: '', obs: '' }]);
                          }
                        }}
                        className="flex-1 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg flex justify-center items-center active:scale-95 shadow-xs transition-all"
                      >
                        <CheckCircle size={14} className="mr-1 text-emerald-400" /> Registrar Todos
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <h3 className="font-bold text-xs text-neutral-700 mb-1.5">Defeitos Registrados ({report.defects.length})</h3>
              {report.defects.length === 0 ? (
                <p className="text-neutral-400 text-xs text-center py-2 bg-neutral-50 rounded-lg">Nenhum defeito registrado neste turno.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {report.defects.map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-1.5 border border-neutral-200 rounded-lg bg-neutral-50/80">
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-neutral-900 bg-orange-100 text-orange-900 px-1 rounded">{d.quantity}x</span>
                          <span className="font-semibold text-xs text-neutral-800 truncate">{d.name}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate mt-0.5">
                          <Clock size={10} className="inline mr-0.5" /> {d.time}
                          {d.observation && <span className="ml-1 text-neutral-600">• {d.observation}</span>}
                        </div>
                      </div>
                      {!isLocked && (
                        <button onClick={() => {
                          const newDefects = [...report.defects];
                          newDefects.splice(i, 1);
                          update({ defects: newDefects });
                        }} className="text-neutral-400 hover:text-red-500 p-1 flex-shrink-0" title="Excluir">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: OBS */}
        {activeTab === 'obs' && (
          <div className="space-y-2.5 w-full max-w-3xl mx-auto">
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-neutral-200">
              <h2 className="text-sm font-bold text-neutral-800 mb-2 pb-1.5 border-b border-neutral-100">Observações e Trocas</h2>
              
              {!isLocked && (
                <div className="bg-neutral-50/80 p-2 rounded-lg border border-neutral-200 mb-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-xs font-semibold text-neutral-600">Horário:</label>
                    <div className="w-28">
                      <TimeInput 
                        value={obsTime}
                        onChange={(newTime) => setObsTime(newTime)}
                        shift={report.shift}
                        className="py-1 px-1.5 text-xs font-bold"
                        label="Horário da observação"
                      />
                    </div>
                  </div>
                  <textarea
                    id="new-obs"
                    className="w-full p-2 bg-white border border-neutral-300 rounded-lg mb-1.5 min-h-[70px] outline-none focus:border-orange-500 font-medium text-xs text-neutral-800"
                    placeholder="Registre informações sobre o processo, ocorrências e problemas encontrados durante o turno..."
                  />
                  <button 
                    onClick={() => {
                      const obs = (document.getElementById('new-obs') as HTMLTextAreaElement).value;
                      if (!obs) return;
                      update({ observations: [...report.observations, { time: obsTime, description: obs }] });
                      (document.getElementById('new-obs') as HTMLTextAreaElement).value = '';
                      setObsTime(new Date().toTimeString().substring(0, 5));
                    }}
                    className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold rounded-lg flex justify-center items-center active:scale-95 transition-all shadow-xs"
                  >
                    <Plus size={14} className="mr-1" /> Adicionar Observação
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                {report.observations.map((o, i) => (
                  <div key={i} className="p-2 border border-neutral-200 rounded-lg bg-neutral-50/80">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[11px] font-bold text-neutral-600"><Clock size={11} className="inline mr-1" /> {o.time}</span>
                      {!isLocked && (
                        <button onClick={() => {
                          const newObs = [...report.observations];
                          newObs.splice(i, 1);
                          update({ observations: newObs });
                        }} className="text-neutral-400 hover:text-red-500 p-0.5">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-800">{o.description}</p>
                  </div>
                ))}
                {report.observations.length === 0 && <p className="text-center text-neutral-400 text-xs py-2 bg-neutral-50 rounded-lg">Nenhuma observação registrada.</p>}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SUMMARY & PDF */}
        {activeTab === 'summary' && (
          <div className="space-y-2.5 w-full max-w-xl mx-auto">
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-neutral-200">
              <h2 className="text-sm font-bold text-neutral-800 mb-3 text-center pb-2 border-b border-neutral-100">Resumo do Relatório</h2>
              
              <div className="divide-y divide-neutral-100 mb-4 text-xs text-neutral-700">
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-neutral-500">Status</span>
                  <span className={clsx("font-bold px-2 py-0.5 rounded text-[11px]", 
                    report.status === 'FINALIZADO' ? "bg-neutral-900 text-white" : "bg-orange-100 text-orange-800"
                  )}>
                    {report.status}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-neutral-500">Data e Turno</span>
                  <span className="font-bold">{report.date} • Turno {report.shift}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-neutral-500">Linha</span>
                  <span className="font-bold">{report.line || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-neutral-500">Produto</span>
                  <span className="font-bold">{report.format} / {report.reference}</span>
                </div>
                {report.productChange?.newReference && (
                  <div className="flex justify-between items-center py-1.5 px-2 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="font-bold text-amber-900 text-xs flex items-center gap-1">
                      <RotateCcw size={12} className="text-amber-700" /> Troca de Produto:
                    </span>
                    <span className="font-black text-xs text-amber-950">
                      {report.productChange.newReference}
                      {report.productChange.time && <span className="font-semibold text-amber-800"> ({report.productChange.time})</span>}
                      {report.productChange.newFormat && <span className="font-normal text-neutral-600"> • {report.productChange.newFormat}</span>}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-neutral-500">Total Defeitos</span>
                  <span className="font-bold text-red-600">{report.defects.reduce((acc, d) => acc + d.quantity, 0)}</span>
                </div>
                {report.productionLosses && (
                  <div className="pt-2 mt-2 border-t border-neutral-100">
                    <span className="font-bold text-[11px] text-neutral-600 block mb-1">Granel, Descartes & Repasses:</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="bg-amber-50/70 p-1.5 rounded border border-amber-200">
                        <span className="text-amber-800/80 block text-[10px]">Granel:</span>
                        <strong className="text-amber-950 font-bold">{report.productionLosses.granel || 0} {report.productionLosses.granelUnit || 'paletes'}</strong>
                      </div>
                      <div className="bg-rose-50/70 p-1.5 rounded border border-rose-200">
                        <span className="text-rose-800/80 block text-[10px]">Caixas Rasgadas:</span>
                        <strong className="text-rose-950 font-bold">{report.productionLosses.caixasRasgadas || 0} cx</strong>
                      </div>
                      <div className="bg-blue-50/70 p-1.5 rounded border border-blue-200">
                        <span className="text-blue-800/80 block text-[10px]">Repasses:</span>
                        <strong className="text-blue-950 font-bold">{report.productionLosses.repasses || 0}</strong>
                      </div>
                      <div className="bg-purple-50/70 p-1.5 rounded border border-purple-200">
                        <span className="text-purple-800/80 block text-[10px]">Caçamba Caco:</span>
                        <strong className="text-purple-950 font-bold">{report.productionLosses.cacambaCaco || 0} caçamba(s)</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!isFinalized ? (
                <div className="space-y-2">
                  <button 
                    onClick={handleSendToCloud}
                    disabled={isSyncing}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg flex justify-center items-center active:scale-[0.98] transition-all shadow-xs"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={14} className="mr-1.5 animate-spin text-orange-400" />
                        <span>Enviando dados para a nuvem...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={15} className="mr-1.5 text-orange-400" />
                        <span>Enviar Dados para a Nuvem</span>
                      </>
                    )}
                  </button>

                  <button 
                    onClick={handleFinalize}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg flex justify-center items-center active:scale-[0.98] shadow-xs transition-all"
                  >
                    <CheckCircle size={16} className="mr-1.5" /> Finalizar e Gerar PDF
                  </button>
                </div>
              ) : isAdmin ? (
                <div className="space-y-2">
                  <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center text-xs text-neutral-600 mb-2">
                    <span className="font-semibold text-neutral-800">Modo de Consulta (Administrador)</span>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Relatório finalizado disponível para conferência e emissão do PDF.</p>
                  </div>
                  <button 
                    onClick={() => generatePDF(report)}
                    className="w-full py-2.5 bg-neutral-900 text-white text-xs font-bold rounded-lg flex justify-center items-center active:bg-black shadow-xs transition-all"
                  >
                    <FileDown size={15} className="mr-1.5 text-orange-400" /> Baixar PDF Oficial
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {isEditingFinalized ? (
                    <>
                      <button 
                        onClick={handleSaveAndRegeneratePDF}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex justify-center items-center active:scale-[0.98] transition-all shadow-xs"
                      >
                        <Check size={16} className="mr-1.5 stroke-[3]" /> Salvar Alterações e Atualizar PDF
                      </button>

                      <button 
                        onClick={() => setIsEditingFinalized(false)}
                        className="w-full py-2 bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-semibold rounded-lg flex justify-center items-center active:scale-[0.98] transition-all"
                      >
                        Concluir Edição (Bloquear Alterações)
                      </button>

                      <button 
                        onClick={handleReopenReport}
                        className="w-full py-2 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold border border-neutral-300 rounded-lg flex justify-center items-center active:scale-[0.98] transition-all"
                      >
                        <RotateCcw size={14} className="mr-1.5 text-amber-600" /> Reabrir Relatório (Voltar para "Em Andamento")
                      </button>

                      <button 
                        onClick={() => generatePDF(report)}
                        className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-lg flex justify-center items-center active:scale-[0.98] transition-all"
                      >
                        <FileDown size={14} className="mr-1.5 text-neutral-600" /> Baixar PDF Atual
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => setIsEditingFinalized(true)}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex justify-center items-center active:scale-[0.98] transition-all shadow-xs"
                      >
                        <Pencil size={15} className="mr-1.5" /> Editar Este Relatório
                      </button>

                      <button 
                        onClick={handleReopenReport}
                        className="w-full py-2 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold border border-neutral-300 rounded-lg flex justify-center items-center active:scale-[0.98] transition-all"
                      >
                        <RotateCcw size={14} className="mr-1.5 text-amber-600" /> Reabrir Relatório (Voltar para "Em Andamento")
                      </button>

                      <button 
                        onClick={() => generatePDF(report)}
                        className="w-full py-2.5 bg-neutral-900 text-white text-xs font-bold rounded-lg flex justify-center items-center active:bg-black shadow-xs transition-all"
                      >
                        <FileDown size={15} className="mr-1.5" /> Baixar PDF Novamente
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useReportStore, Report } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import { ChevronLeft, Plus, Trash2, CheckCircle, Save, FileDown, ArrowRight, Clock, UploadCloud, Check, RefreshCw, Sparkles, Pencil, Edit3, RotateCcw, AlertCircle } from 'lucide-react';
import { DEFECTS_LIST, SHIFT_HOURS } from '../lib/constants';
import { generatePDF } from '../lib/pdfGenerator';
import clsx from 'clsx';
import CloudSyncBadge from '../components/CloudSyncBadge';
import TimeInput from '../components/TimeInput';

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

type TabKey = 'info' | 'thickness' | 'warp' | 'centralCurvature' | 'lateralCurvature' | 'process' | 'weights' | 'defects' | 'obs' | 'summary';

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [defectTime, setDefectTime] = useState(new Date().toTimeString().substring(0, 5));
  const [obsTime, setObsTime] = useState(new Date().toTimeString().substring(0, 5));
  const [defectEntries, setDefectEntries] = useState([{ id: '', amount: '', obs: '' }]);
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
      const newId = createNewReport({ leaderName: user?.name });
      navigate(`/reports/edit/${newId}`, { replace: true });
    }
  }, [id, createNewReport, setCurrentReport, navigate, user]);

  const report = reports.find(r => r.id === currentReportId);

  if (!report) return <div className="p-8 text-center">Carregando...</div>;

  const isFinalized = report.status === 'FINALIZADO';
  const isLocked = isFinalized && !isEditingFinalized;

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
      return existing ? { ...existing, time } : { time, cv: 'A', l1: 0, l2: 0, l3: 0, l4: 0 };
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
        return existing ? { ...existing, time } : { time, cv: 'A', l1: 0, l2: 0, l3: 0, l4: 0 };
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

  const TABS: { id: TabKey; label: string }[] = [
    { id: 'info', label: 'Identificação' },
    { id: 'thickness', label: 'Espessura' },
    { id: 'warp', label: 'Empeno' },
    { id: 'centralCurvature', label: 'Curvatura Central' },
    { id: 'lateralCurvature', label: 'Curvatura Lateral' },
    { id: 'process', label: 'Processo' },
    { id: 'weights', label: 'Pesagem Caixa' },
    { id: 'defects', label: 'Defeitos' },
    { id: 'obs', label: 'Observações' },
    { id: 'summary', label: 'Resumo & PDF' }
  ];

  const renderCurvatureSection = (key: 'warp' | 'centralCurvature' | 'lateralCurvature', title: string) => (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-neutral-800">{title}</h2>
          {!isLocked && (
            <div className="flex flex-wrap items-center gap-2">
              <button 
                type="button"
                onClick={() => handleDefineShiftHoursForSection(key)}
                className="flex items-center text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-2 rounded-lg border border-neutral-200 active:scale-95 transition-all"
                title="Definir as 8 horas do turno"
              >
                <Clock size={13} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
              </button>
              {isLiderMatriz2 && (report as any)[key].length > 0 && (
                <button 
                  type="button"
                  onClick={() => handleAutoFillAllPieces(key)}
                  className="flex items-center text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-2 rounded-lg border border-amber-300 active:scale-95 transition-all"
                  title="Gera peças 2 a 7 para todas as horas com base na Peça 1"
                >
                  <Sparkles size={13} className="mr-1 text-amber-600 stroke-[2.5]" /> Auto Pçs 2-7 em Todas
                </button>
              )}
              <button 
                onClick={() => {
                  const nextTime = getNextShiftHour(((report as any)[key] || []).map((t: any) => t.time), report.shift);
                  update({ [key]: [...(report as any)[key], { time: nextTime, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 }] });
                }}
                className="flex items-center text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg border border-orange-200 active:scale-95 transition-all"
              >
                <Plus size={14} className="mr-1" /> Adicionar
              </button>
            </div>
          )}
        </div>

        {(report as any)[key].length === 0 ? (
          <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhuma medição registrada.</p>
        ) : (
          <div className="space-y-6">
            {(report as any)[key].map((item: any, index: number) => (
              <div key={index} className="p-4 border border-neutral-200 rounded-xl bg-neutral-50 overflow-x-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 min-w-[300px] gap-2">
                  <div className="w-36">
                    <TimeInput 
                      value={item.time}
                      onChange={(newTime) => {
                        const newList = [...(report as any)[key]];
                        newList[index].time = newTime;
                        update({ [key]: newList });
                      }}
                      disabled={isLocked}
                      shift={report.shift}
                      className="p-2 text-sm"
                      label={`Medição ${index + 1} - ${title}`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {isLiderMatriz2 && !isLocked && (
                      <button 
                        type="button"
                        onClick={() => handleAutoFillPieces(key, index)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                        title="Preenche as peças 2 a 7 automaticamente com números próximos aos da Peça 1"
                      >
                        <Sparkles size={13} className="stroke-[2.5]" />
                        <span>Auto Pçs 2 a 7</span>
                      </button>
                    )}

                    {!isLocked && (
                      <button 
                        onClick={() => {
                          const newList = [...(report as any)[key]];
                          newList.splice(index, 1);
                          update({ [key]: newList });
                        }}
                        className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir medição"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  {['pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7'].map((col, pcIdx) => (
                    <div key={col} className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-700">Peça {pcIdx + 1}</span>
                          {isLiderMatriz2 && !isLocked && pcIdx === 0 && (
                            <button
                              type="button"
                              onClick={() => handleAutoFillPieces(key, index)}
                              className="text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                              title="Coloque a medida desta 1ª peça e clique aqui para preencher as peças 2 a 7 com valores próximos"
                            >
                              <Sparkles size={11} className="stroke-[2.5] text-amber-600" />
                              <span>Gerar Pçs 2 a 7</span>
                            </button>
                          )}
                        </div>
                        <span className="text-xs font-bold text-orange-800 bg-orange-100 px-2 py-1 rounded">
                          Maior: {item[col] || 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[0, 1, 2, 3].map(sideIdx => (
                          <div key={sideIdx}>
                            <label className="block text-center text-[10px] text-neutral-500 mb-1">L{sideIdx + 1}</label>
                            <input
                              type="number"
                              step="0.1"
                              value={item[`${col}_s`]?.[sideIdx] ?? ''}
                              onChange={(e) => {
                                const newList = [...(report as any)[key]];
                                const sides = [...(newList[index][`${col}_s`] || [0,0,0,0])];
                                sides[sideIdx] = parseFloat(e.target.value) || 0;
                                newList[index][`${col}_s`] = sides;
                                newList[index][col] = Math.max(...sides.map(v => v || 0));
                                update({ [key]: newList });
                              }}
                              disabled={isLocked}
                              className="w-full p-2 text-center text-sm border border-neutral-300 rounded bg-neutral-50"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-neutral-200 flex justify-between items-center">
                  <span className="text-sm font-bold text-neutral-700">MAIOR DA HORA:</span>
                  <span className="text-lg font-black text-neutral-900 bg-neutral-200 px-3 py-1 rounded">
                    {Math.max(item.pc1 || 0, item.pc2 || 0, item.pc3 || 0, item.pc4 || 0, item.pc5 || 0, item.pc6 || 0, item.pc7 || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-2 min-w-0 mr-2">
          <Link to="/" className="p-2 bg-neutral-100 rounded-full active:scale-95 flex-shrink-0">
            <ChevronLeft size={22} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-neutral-800 truncate">
                {isFinalized ? (isEditingFinalized ? 'Editando Relatório' : 'Relatório Finalizado') : 'Preencher Relatório'}
              </h1>
              {isFinalized && (
                <span className={clsx(
                  "text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md",
                  isEditingFinalized ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-neutral-900 text-white"
                )}>
                  {isEditingFinalized ? 'Modo Edição' : 'Finalizado'}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 truncate">
              {isFinalized && isEditingFinalized 
                ? 'Edição habilitada • As alterações serão salvas' 
                : 'Salvo no aparelho • Envio sob demanda'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Botão de alternar Edição em Relatório Finalizado */}
          {isFinalized && (
            <button
              type="button"
              onClick={() => setIsEditingFinalized(!isEditingFinalized)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all",
                isEditingFinalized
                  ? "bg-amber-500 hover:bg-amber-600 text-white border border-amber-600"
                  : "bg-neutral-900 hover:bg-black text-white"
              )}
              title={isEditingFinalized ? "Clique para concluir ou pausar a edição" : "Clique para habilitar a edição deste relatório"}
            >
              <Pencil size={13} className={isEditingFinalized ? "text-amber-100" : "text-orange-400"} />
              <span>{isEditingFinalized ? 'Concluir Edição' : 'Editar Relatório'}</span>
            </button>
          )}

          {!isLocked && (
            <button
              onClick={handleSendToCloud}
              disabled={isSyncing}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all",
                report.syncStatus === 'pending'
                  ? "bg-orange-500 hover:bg-orange-600 text-white animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
              title="Aperte para enviar os dados deste relatório para a nuvem"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : report.syncStatus === 'pending' ? (
                <>
                  <UploadCloud size={14} />
                  <span>Enviar Dados</span>
                </>
              ) : (
                <>
                  <Check size={13} className="stroke-[3]" />
                  <span>Nuvem Salva</span>
                </>
              )}
            </button>
          )}
          <CloudSyncBadge showLabel={false} />
        </div>
      </header>

      {syncFeedback && (
        <div className="bg-neutral-900 text-white text-xs font-medium py-2 px-4 text-center sticky top-[57px] z-20 shadow-md">
          {syncFeedback}
        </div>
      )}

      {/* Banner informativo de modo de edição para relatório finalizado */}
      {isFinalized && isEditingFinalized && (
        <div className="bg-amber-500 text-white text-xs font-bold py-2.5 px-4 flex flex-wrap items-center justify-between gap-2 sticky top-[57px] z-20 shadow-md">
          <div className="flex items-center gap-2">
            <Pencil size={14} className="stroke-[2.5]" />
            <span>Modo de Edição Ativo: você pode alterar dados, medições e defeitos.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAndRegeneratePDF}
              className="bg-white text-amber-900 px-3 py-1 rounded-lg text-xs font-black hover:bg-amber-50 active:scale-95 transition-all shadow-xs"
            >
              Salvar e Atualizar PDF
            </button>
            <button
              type="button"
              onClick={() => setIsEditingFinalized(false)}
              className="bg-amber-700 hover:bg-amber-800 text-white px-2.5 py-1 rounded-lg text-xs font-semibold active:scale-95 transition-all"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {isFinalized && !isEditingFinalized && (
        <div className="bg-neutral-800 text-neutral-200 text-xs font-medium py-2 px-4 flex items-center justify-between sticky top-[57px] z-20 shadow-sm">
          <span>Relatório finalizado em modo somente leitura.</span>
          <button
            type="button"
            onClick={() => setIsEditingFinalized(true)}
            className="text-orange-400 hover:text-orange-300 font-bold underline flex items-center gap-1.5 active:scale-95"
          >
            <Pencil size={13} /> Habilitar Edição
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-neutral-200 overflow-x-auto hide-scrollbar sticky top-[73px] z-10">
        <div className="flex px-2 py-2 w-max">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-5 py-3 rounded-full text-sm font-semibold mx-1 whitespace-nowrap transition-colors",
                activeTab === tab.id ? "bg-neutral-900 text-white shadow-md" : "bg-neutral-100 text-neutral-600 border border-transparent hover:border-neutral-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        
        {/* TAB 1: IDENTIFICATION */}
        {activeTab === 'info' && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <h2 className="text-lg font-bold mb-4 text-neutral-800">Identificação do Relatório</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Data *</label>
                  <input 
                    type="date" 
                    value={report.date} 
                    onChange={e => update({ date: e.target.value })}
                    disabled={isLocked}
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Turno *</label>
                  <div className="flex gap-2">
                    {['A', 'B', 'C', 'D'].map(shift => (
                      <button
                        key={shift}
                        onClick={() => update({ shift })}
                        disabled={isLocked}
                        className={clsx(
                          "flex-1 py-4 rounded-xl font-bold border transition-colors",
                          report.shift === shift ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-700 border-neutral-200"
                        )}
                      >
                        {shift}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                    <div className="text-xs text-neutral-600">
                      <span className="font-bold text-neutral-800">Horários Turno {report.shift}:</span>{' '}
                      {(SHIFT_HOURS[report.shift] || []).join(' • ')}
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleDefineShiftHours(report.shift)}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap ml-2"
                        title="Definir os horários deste turno em todas as seções"
                      >
                        <Clock size={13} />
                        <span>Definir Horários</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Linha *</label>
                  <input 
                    type="text" 
                    value={report.line} 
                    onChange={e => update({ line: e.target.value })}
                    disabled={isLocked}
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Ex: Linha 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Formato</label>
                  <input 
                    type="text" 
                    value={report.format} 
                    onChange={e => update({ format: e.target.value })}
                    disabled={isLocked}
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Ex: 60x60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Referência</label>
                  <input 
                    type="text" 
                    value={report.reference} 
                    onChange={e => update({ reference: e.target.value })}
                    disabled={isLocked}
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Código do produto"
                  />
                </div>
              </div>

              <button 
                onClick={() => setActiveTab('thickness')}
                className="w-full mt-6 flex items-center justify-center p-4 bg-neutral-800 text-white font-bold rounded-xl active:bg-neutral-900"
              >
                Avançar para Espessura <ArrowRight size={20} className="ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: THICKNESS */}
        {activeTab === 'thickness' && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-neutral-800">Controle de Espessura</h2>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => handleDefineShiftHoursForSection('thickness')}
                      className="flex items-center text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-2 rounded-lg border border-neutral-200 active:scale-95 transition-all"
                      title="Definir as 8 horas do turno"
                    >
                      <Clock size={13} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
                    </button>
                    <button 
                      onClick={() => {
                        const nextTime = getNextShiftHour(report.thickness.map(t => t.time), report.shift);
                        update({ thickness: [...report.thickness, { time: nextTime, cv: 'A', l1: 0, l2: 0, l3: 0, l4: 0 }] });
                      }}
                      className="flex items-center text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg border border-orange-200 active:scale-95 transition-all"
                    >
                      <Plus size={14} className="mr-1" /> Adicionar
                    </button>
                  </div>
                )}
              </div>

              {report.thickness.length === 0 ? (
                <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhuma medição registrada.</p>
              ) : (
                <div className="space-y-6">
                  {report.thickness.map((item, index) => (
                    <div key={index} className="p-4 border border-neutral-200 rounded-xl bg-neutral-50">
                      <div className="flex justify-between items-center mb-4 gap-3">
                        <div className="w-36">
                          <TimeInput 
                            value={item.time}
                            onChange={(newTime) => {
                              const newThick = [...report.thickness];
                              newThick[index].time = newTime;
                              update({ thickness: newThick });
                            }}
                            disabled={isLocked}
                            shift={report.shift}
                            className="p-2 text-sm"
                            label={`Medição ${index + 1} - Espessura`}
                          />
                        </div>
                        {!isLocked && (
                          <button 
                            onClick={() => {
                              const newThick = [...report.thickness];
                              newThick.splice(index, 1);
                              update({ thickness: newThick });
                            }}
                            className="text-red-500 p-2"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-neutral-500 mb-2">Classificação (C/V)</label>
                        <div className="flex gap-2">
                          {['A', 'AR', 'R'].map(status => (
                            <button
                              key={status}
                              onClick={() => {
                                const newThick = [...report.thickness];
                                newThick[index].cv = status;
                                update({ thickness: newThick });
                              }}
                              disabled={isLocked}
                              className={clsx(
                                "flex-1 py-2 text-sm font-bold rounded-lg border",
                                item.cv === status ? (status === 'R' ? 'bg-red-500 text-white border-red-500' : status === 'AR' ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-900 text-white border-neutral-900') : 'bg-white text-neutral-600'
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {['l1', 'l2', 'l3', 'l4'].map((col) => (
                          <div key={col}>
                            <label className="block text-center text-xs font-semibold text-neutral-500 mb-1">{col.toUpperCase()}</label>
                            <input 
                              type="number" 
                              step="0.1"
                              value={(item as any)[col]}
                              onChange={(e) => {
                                const newThick = [...report.thickness];
                                (newThick[index] as any)[col] = parseFloat(e.target.value) || 0;
                                update({ thickness: newThick });
                              }}
                              disabled={isLocked}
                              className="w-full p-2 text-center border border-neutral-300 rounded-lg bg-white"
                            />
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

        {/* TAB 3: EMPENO */}
        {activeTab === 'warp' && renderCurvatureSection('warp', 'Empeno')}

        {/* TAB 4: CURVATURA CENTRAL */}
        {activeTab === 'centralCurvature' && renderCurvatureSection('centralCurvature', 'Curvatura Central (CC)')}

        {/* TAB 5: CURVATURA LATERAL */}
        {activeTab === 'lateralCurvature' && renderCurvatureSection('lateralCurvature', 'Curvatura Lateral (CL)')}

        {/* TAB: PROCESSO */}
        {activeTab === 'process' && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-neutral-800">Controle de Processo</h2>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => handleDefineShiftHoursForSection('process')}
                      className="flex items-center text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-2 rounded-lg border border-neutral-200 active:scale-95 transition-all"
                      title="Definir as 8 horas do turno"
                    >
                      <Clock size={13} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
                    </button>
                    <button 
                      onClick={() => {
                        const nextTime = getNextShiftHour((report.processChecks || []).map(t => t.time), report.shift);
                        update({ processChecks: [...(report.processChecks || []), { time: nextTime, taratura: '-', corte: '-', lascamento: '-' }] });
                      }}
                      className="flex items-center text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg border border-orange-200 active:scale-95 transition-all"
                    >
                      <Plus size={14} className="mr-1" /> Adicionar
                    </button>
                  </div>
                )}
              </div>

              {(!report.processChecks || report.processChecks.length === 0) ? (
                <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhum controle registrado.</p>
              ) : (
                <div className="space-y-4">
                  {report.processChecks.map((item, index) => (
                    <div key={index} className="p-4 border border-neutral-200 rounded-xl bg-neutral-50">
                      <div className="flex justify-between items-center mb-4 gap-3">
                        <div className="w-36">
                          <TimeInput 
                            value={item.time}
                            onChange={(newTime) => {
                              const newList = [...report.processChecks];
                              newList[index].time = newTime;
                              update({ processChecks: newList });
                            }}
                            disabled={isLocked}
                            shift={report.shift}
                            className="p-2 text-sm"
                            label={`Verificação ${index + 1} - Processo`}
                          />
                        </div>
                        {!isLocked && (
                          <button 
                            onClick={() => {
                              const newList = [...report.processChecks];
                              newList.splice(index, 1);
                              update({ processChecks: newList });
                            }}
                            className="text-red-500 p-2"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {(['taratura', 'corte', 'lascamento'] as const).map(field => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-neutral-700 mb-1 capitalize">{field}</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const newList = [...report.processChecks];
                                  newList[index][field] = 'OK';
                                  update({ processChecks: newList });
                                }}
                                disabled={isLocked}
                                className={clsx(
                                  "flex-1 py-2 rounded-lg text-sm font-bold transition-colors",
                                  item[field] === 'OK' 
                                    ? "bg-neutral-900 text-white shadow-md" 
                                    : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
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
                                  "flex-1 py-2 rounded-lg text-sm font-bold transition-colors",
                                  item[field] === 'Ruim' 
                                    ? "bg-red-500 text-white shadow-md" 
                                    : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
                                )}
                              >
                                RUIM
                              </button>
                            </div>
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
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-neutral-800">Pesagem da Caixa</h2>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => handleDefineShiftHoursForSection('weights')}
                      className="flex items-center text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-2 rounded-lg border border-neutral-200 active:scale-95 transition-all"
                      title="Definir as 8 horas do turno"
                    >
                      <Clock size={13} className="mr-1 text-orange-500" /> Horários Turno {report.shift}
                    </button>
                    <button 
                      onClick={() => {
                        const nextTime = getNextShiftHour((report.boxWeights || []).map(t => t.time), report.shift);
                        update({ boxWeights: [...(report.boxWeights || []), { time: nextTime, weight: 0 }] });
                      }}
                      className="flex items-center text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg border border-orange-200 active:scale-95 transition-all"
                    >
                      <Plus size={14} className="mr-1" /> Adicionar
                    </button>
                  </div>
                )}
              </div>

              {(!report.boxWeights || report.boxWeights.length === 0) ? (
                <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhuma pesagem registrada.</p>
              ) : (
                <div className="space-y-4">
                  {report.boxWeights.map((item, index) => (
                    <div key={index} className="flex gap-3 p-4 border border-neutral-200 rounded-xl bg-neutral-50 items-center">
                      <div className="w-36">
                        <label className="block text-xs font-semibold text-neutral-500 mb-1">Hora</label>
                        <TimeInput 
                          value={item.time}
                          onChange={(newTime) => {
                            const newList = [...report.boxWeights];
                            newList[index].time = newTime;
                            update({ boxWeights: newList });
                          }}
                          disabled={isLocked}
                          shift={report.shift}
                          className="w-full p-2 text-sm"
                          label={`Pesagem ${index + 1}`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-neutral-500 mb-1">Peso (kg)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.weight || ''}
                          onChange={(e) => {
                            const newList = [...report.boxWeights];
                            newList[index].weight = parseFloat(e.target.value) || 0;
                            update({ boxWeights: newList });
                          }}
                          disabled={isLocked}
                          className="w-full p-2 border border-neutral-300 rounded-lg bg-white font-semibold text-neutral-800 outline-none focus:border-orange-500"
                        />
                      </div>
                      {!isLocked && (
                        <button 
                          onClick={() => {
                            const newList = [...report.boxWeights];
                            newList.splice(index, 1);
                            update({ boxWeights: newList });
                          }}
                          className="text-red-500 p-2 mt-4"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DEFECTS */}
        {activeTab === 'defects' && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Registro Rápido de Defeitos</h2>
              
              {!isLocked && (
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-6">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Horário do Registro</label>
                    <TimeInput 
                      value={defectTime}
                      onChange={(newTime) => setDefectTime(newTime)}
                      shift={report.shift}
                      className="w-full p-3 font-bold text-base"
                      label="Horário do lote de defeitos"
                    />
                  </div>

                  <div className="space-y-4">
                    {defectEntries.map((entry, index) => (
                      <div key={index} className="p-4 bg-white border border-neutral-300 rounded-xl relative shadow-sm">
                        {defectEntries.length > 1 && (
                          <button 
                            onClick={() => {
                              const newEntries = [...defectEntries];
                              newEntries.splice(index, 1);
                              setDefectEntries(newEntries);
                            }}
                            className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full shadow-sm hover:bg-red-200"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-1">Defeito</label>
                            <select 
                              value={entry.id}
                              onChange={(e) => {
                                const newEntries = [...defectEntries];
                                newEntries[index].id = e.target.value;
                                setDefectEntries(newEntries);
                              }}
                              className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-lg outline-none"
                            >
                              <option value="">Selecione...</option>
                              {DEFECTS_LIST.map(d => (
                                <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                                Leitura Atual
                              </label>
                              <input 
                                type="number" 
                                value={entry.amount}
                                onChange={(e) => {
                                  const newEntries = [...defectEntries];
                                  newEntries[index].amount = e.target.value;
                                  setDefectEntries(newEntries);
                                }}
                                placeholder="Total Ex: 150"
                                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-lg" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-700 mb-1">Observação</label>
                              <input 
                                type="text" 
                                value={entry.obs}
                                onChange={(e) => {
                                  const newEntries = [...defectEntries];
                                  newEntries[index].obs = e.target.value;
                                  setDefectEntries(newEntries);
                                }}
                                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-lg" 
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
                              <div className="text-sm px-1 text-orange-700 mt-2">
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
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => setDefectEntries([...defectEntries, { id: '', amount: '', obs: '' }])}
                      className="w-full py-3 bg-neutral-200 text-neutral-700 font-bold rounded-xl flex justify-center items-center active:bg-neutral-300 transition-colors"
                    >
                      <Plus size={18} className="mr-2" /> Adicionar Outro Defeito
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
                      className="w-full py-4 mt-4 bg-neutral-900 text-white font-bold rounded-xl flex justify-center items-center active:bg-black shadow-md transition-colors"
                    >
                      <CheckCircle size={20} className="mr-2" /> Registrar Todos
                    </button>
                  </div>
                </div>
              )}

              <h3 className="font-bold text-neutral-700 mb-4">Defeitos Registrados ({report.defects.length})</h3>
              <div className="space-y-3">
                {report.defects.map((d, i) => (
                  <div key={i} className="flex justify-between items-start p-4 border border-neutral-200 rounded-xl bg-white">
                    <div>
                      <div className="flex items-center">
                        <span className="font-bold text-lg text-neutral-800 mr-2">{d.quantity}x</span>
                        <span className="font-semibold text-neutral-700">{d.name}</span>
                      </div>
                      <div className="text-sm text-neutral-500 mt-1">
                        <Clock size={14} className="inline mr-1" /> {d.time}
                        {d.observation && <span className="ml-2">• {d.observation}</span>}
                      </div>
                    </div>
                    {!isLocked && (
                      <button onClick={() => {
                        const newDefects = [...report.defects];
                        newDefects.splice(i, 1);
                        update({ defects: newDefects });
                      }} className="text-red-500 p-2">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: OBS */}
        {activeTab === 'obs' && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Observações e Trocas</h2>
              
              {!isLocked && (
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-6">
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">Horário da Ocorrência</label>
                    <div className="w-36">
                      <TimeInput 
                        value={obsTime}
                        onChange={(newTime) => setObsTime(newTime)}
                        shift={report.shift}
                        className="p-2 text-sm"
                        label="Horário da observação"
                      />
                    </div>
                  </div>
                  <textarea
                    id="new-obs"
                    className="w-full p-4 bg-white border border-neutral-300 rounded-xl mb-4 min-h-[120px] outline-none focus:border-orange-500 font-medium text-neutral-800"
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
                    className="w-full py-4 bg-neutral-800 text-white font-bold rounded-xl flex justify-center items-center active:bg-neutral-900 shadow-md"
                  >
                    <Plus size={20} className="mr-2" /> Adicionar Observação
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {report.observations.map((o, i) => (
                  <div key={i} className="p-4 border border-neutral-200 rounded-xl bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-bold text-neutral-500"><Clock size={14} className="inline mr-1" /> {o.time}</span>
                      {!isLocked && (
                        <button onClick={() => {
                          const newObs = [...report.observations];
                          newObs.splice(i, 1);
                          update({ observations: newObs });
                        }} className="text-red-500">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-neutral-800">{o.description}</p>
                  </div>
                ))}
                {report.observations.length === 0 && <p className="text-center text-neutral-500">Nenhuma observação registrada.</p>}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SUMMARY & PDF */}
        {activeTab === 'summary' && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <h2 className="text-xl font-bold text-neutral-800 mb-6 text-center">Resumo do Relatório</h2>
              
              <div className="space-y-4 mb-8 text-neutral-700">
                <div className="flex justify-between py-3 border-b border-neutral-100">
                  <span className="font-semibold text-neutral-500">Status</span>
                  <span className={clsx("font-bold px-2.5 py-0.5 rounded-full text-xs", 
                    report.status === 'FINALIZADO' ? "bg-neutral-900 text-white" : "bg-orange-100 text-orange-800"
                  )}>
                    {report.status}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-neutral-100">
                  <span className="font-semibold text-neutral-500">Data e Turno</span>
                  <span className="font-bold">{report.date} • Turno {report.shift}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-neutral-100">
                  <span className="font-semibold text-neutral-500">Linha</span>
                  <span className="font-bold">{report.line || '-'}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-neutral-100">
                  <span className="font-semibold text-neutral-500">Produto</span>
                  <span className="font-bold">{report.format} / {report.reference}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-neutral-100">
                  <span className="font-semibold text-neutral-500">Total Defeitos</span>
                  <span className="font-bold text-red-600">{report.defects.reduce((acc, d) => acc + d.quantity, 0)}</span>
                </div>
              </div>

              {!isFinalized ? (
                <div className="space-y-3">
                  <button 
                    onClick={handleSendToCloud}
                    disabled={isSyncing}
                    className="w-full py-4 bg-neutral-900 hover:bg-black text-white font-bold rounded-2xl flex justify-center items-center text-base active:scale-[0.98] transition-all shadow-md"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={18} className="mr-2 animate-spin text-orange-400" />
                        <span>Enviando dados para a nuvem...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={20} className="mr-2 text-orange-400" />
                        <span>Enviar Dados para a Nuvem</span>
                      </>
                    )}
                  </button>

                  <button 
                    onClick={handleFinalize}
                    className="w-full py-5 bg-orange-500 text-white font-bold rounded-2xl flex justify-center items-center text-lg active:bg-orange-600 shadow-lg shadow-orange-200"
                  >
                    <CheckCircle size={24} className="mr-2" /> Finalizar e Gerar PDF
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {isEditingFinalized ? (
                    <>
                      <button 
                        onClick={handleSaveAndRegeneratePDF}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl flex justify-center items-center text-base active:scale-[0.98] transition-all shadow-md"
                      >
                        <Check size={20} className="mr-2 stroke-[3]" /> Salvar Alterações e Atualizar PDF
                      </button>

                      <button 
                        onClick={() => setIsEditingFinalized(false)}
                        className="w-full py-3.5 bg-neutral-800 hover:bg-neutral-900 text-white font-semibold rounded-2xl flex justify-center items-center text-sm active:scale-[0.98] transition-all"
                      >
                        Concluir Edição (Bloquear Alterações)
                      </button>

                      <button 
                        onClick={handleReopenReport}
                        className="w-full py-3.5 bg-white hover:bg-neutral-50 text-neutral-700 font-semibold border border-neutral-300 rounded-2xl flex justify-center items-center text-sm active:scale-[0.98] transition-all"
                      >
                        <RotateCcw size={16} className="mr-2 text-amber-600" /> Reabrir Relatório (Voltar para "Em Andamento")
                      </button>

                      <button 
                        onClick={() => generatePDF(report)}
                        className="w-full py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold rounded-2xl flex justify-center items-center text-sm active:scale-[0.98] transition-all"
                      >
                        <FileDown size={18} className="mr-2 text-neutral-600" /> Baixar PDF Atual
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => setIsEditingFinalized(true)}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl flex justify-center items-center text-base active:scale-[0.98] transition-all shadow-md"
                      >
                        <Pencil size={20} className="mr-2" /> Editar Este Relatório
                      </button>

                      <button 
                        onClick={handleReopenReport}
                        className="w-full py-3.5 bg-white hover:bg-neutral-50 text-neutral-700 font-semibold border border-neutral-300 rounded-2xl flex justify-center items-center text-sm active:scale-[0.98] transition-all"
                      >
                        <RotateCcw size={16} className="mr-2 text-amber-600" /> Reabrir Relatório (Voltar para "Em Andamento")
                      </button>

                      <button 
                        onClick={() => generatePDF(report)}
                        className="w-full py-4 bg-neutral-900 text-white font-bold rounded-2xl flex justify-center items-center text-base active:bg-black shadow-md"
                      >
                        <FileDown size={20} className="mr-2" /> Baixar PDF Novamente
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

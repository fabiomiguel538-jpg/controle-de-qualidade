import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useReportStore, Report } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import { ChevronLeft, Plus, Trash2, CheckCircle, Save, FileDown, ArrowRight, Clock } from 'lucide-react';
import { DEFECTS_LIST } from '../lib/constants';
import { generatePDF } from '../lib/pdfGenerator';
import clsx from 'clsx';
import CloudSyncBadge from '../components/CloudSyncBadge';

export default function ReportForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuthStore();
  const { reports, createNewReport, updateCurrentReport, setCurrentReport, currentReportId, finalizeReport } = useReportStore();
  
  const [activeTab, setActiveTab] = useState<'info' | 'thickness' | 'warp' | 'process' | 'weights' | 'defects' | 'obs' | 'summary'>('info');
  const [defectTime, setDefectTime] = useState(new Date().toTimeString().substring(0, 5));
  const [defectEntries, setDefectEntries] = useState([{ id: '', amount: '', obs: '' }]);

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

  const update = (updates: Partial<Report>) => {
    if (isFinalized) return;
    updateCurrentReport(updates);
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

  const TABS = [
    { id: 'info', label: 'Identificação' },
    { id: 'thickness', label: 'Espessura' },
    { id: 'warp', label: 'Empeno / Curvatura' },
    { id: 'process', label: 'Processo' },
    { id: 'weights', label: 'Pesagem da Caixa' },
    { id: 'defects', label: 'Defeitos' },
    { id: 'obs', label: 'Observações' },
    { id: 'summary', label: 'Resumo & PDF' }
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-4 py-4 flex items-center shadow-sm z-10 sticky top-0">
        <Link to="/" className="p-2 mr-2 bg-neutral-100 rounded-full active:scale-95">
          <ChevronLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-neutral-800">
            {isFinalized ? 'Relatório Finalizado' : 'Preencher Relatório'}
          </h1>
          <p className="text-xs text-neutral-500">Salvo automaticamente na nuvem</p>
        </div>
        <CloudSyncBadge />
      </header>

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
                    disabled={isFinalized}
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
                        disabled={isFinalized}
                        className={clsx(
                          "flex-1 py-4 rounded-xl font-bold border transition-colors",
                          report.shift === shift ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-700 border-neutral-200"
                        )}
                      >
                        {shift}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Linha *</label>
                  <input 
                    type="text" 
                    value={report.line} 
                    onChange={e => update({ line: e.target.value })}
                    disabled={isFinalized}
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
                    disabled={isFinalized}
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
                    disabled={isFinalized}
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-neutral-800">Controle de Espessura</h2>
                {!isFinalized && (
                  <button 
                    onClick={() => {
                      const now = new Date().toTimeString().substring(0, 5);
                      update({ thickness: [...report.thickness, { time: now, cv: 'A', l1: 0, l2: 0, l3: 0, l4: 0 }] });
                    }}
                    className="flex items-center text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg"
                  >
                    <Plus size={16} className="mr-1" /> Adicionar
                  </button>
                )}
              </div>

              {report.thickness.length === 0 ? (
                <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhuma medição registrada.</p>
              ) : (
                <div className="space-y-6">
                  {report.thickness.map((item, index) => (
                    <div key={index} className="p-4 border border-neutral-200 rounded-xl bg-neutral-50">
                      <div className="flex justify-between items-center mb-4">
                        <input 
                          type="time" 
                          value={item.time}
                          onChange={(e) => {
                            const newThick = [...report.thickness];
                            newThick[index].time = e.target.value;
                            update({ thickness: newThick });
                          }}
                          disabled={isFinalized}
                          className="p-2 border rounded-lg bg-white"
                        />
                        {!isFinalized && (
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
                              disabled={isFinalized}
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
                              disabled={isFinalized}
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

        {/* TAB 3: WARP & CURVATURE */}
        {activeTab === 'warp' && (
          <div className="space-y-6 max-w-lg mx-auto">
            {[
              { key: 'warp', title: 'Empeno (E)' },
              { key: 'centralCurvature', title: 'Curvatura Central (CC)' },
              { key: 'lateralCurvature', title: 'Curvatura Lateral (CL)' },
            ].map(({ key, title }) => (
              <div key={key} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-neutral-800">{title}</h2>
                  {!isFinalized && (
                    <button 
                      onClick={() => {
                        const now = new Date().toTimeString().substring(0, 5);
                        update({ [key]: [...(report as any)[key], { time: now, pc1: 0, pc2: 0, pc3: 0, pc4: 0, pc5: 0, pc6: 0, pc7: 0 }] });
                      }}
                      className="flex items-center text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg"
                    >
                      <Plus size={16} className="mr-1" /> Adicionar
                    </button>
                  )}
                </div>

                {(report as any)[key].length === 0 ? (
                  <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhuma medição registrada.</p>
                ) : (
                  <div className="space-y-6">
                    {(report as any)[key].map((item: any, index: number) => (
                      <div key={index} className="p-4 border border-neutral-200 rounded-xl bg-neutral-50 overflow-x-auto">
                        <div className="flex justify-between items-center mb-4 min-w-[300px]">
                          <input 
                            type="time" 
                            value={item.time}
                            onChange={(e) => {
                              const newList = [...(report as any)[key]];
                              newList[index].time = e.target.value;
                              update({ [key]: newList });
                            }}
                            disabled={isFinalized}
                            className="p-2 border rounded-lg bg-white"
                          />
                          {!isFinalized && (
                            <button 
                              onClick={() => {
                                const newList = [...(report as any)[key]];
                                newList.splice(index, 1);
                                update({ [key]: newList });
                              }}
                              className="text-red-500 p-2"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          {['pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7'].map((col, pcIdx) => (
                            <div key={col} className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-neutral-700">Peça {pcIdx + 1}</span>
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
                                      disabled={isFinalized}
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
            ))}
          </div>
        )}

        {/* TAB: PROCESSO */}
        {activeTab === 'process' && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-neutral-800">Controle de Processo</h2>
                {!isFinalized && (
                  <button 
                    onClick={() => {
                      const now = new Date().toTimeString().substring(0, 5);
                      update({ processChecks: [...(report.processChecks || []), { time: now, taratura: '-', corte: '-', lascamento: '-' }] });
                    }}
                    className="flex items-center text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg"
                  >
                    <Plus size={16} className="mr-1" /> Adicionar
                  </button>
                )}
              </div>

              {(!report.processChecks || report.processChecks.length === 0) ? (
                <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhum controle registrado.</p>
              ) : (
                <div className="space-y-4">
                  {report.processChecks.map((item, index) => (
                    <div key={index} className="p-4 border border-neutral-200 rounded-xl bg-neutral-50">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-semibold text-neutral-500">Hora</label>
                          <input 
                            type="time" 
                            value={item.time}
                            onChange={(e) => {
                              const newList = [...report.processChecks];
                              newList[index].time = e.target.value;
                              update({ processChecks: newList });
                            }}
                            disabled={isFinalized}
                            className="p-2 border rounded-lg bg-white"
                          />
                        </div>
                        {!isFinalized && (
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
                                disabled={isFinalized}
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
                                disabled={isFinalized}
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-neutral-800">Pesagem da Caixa</h2>
                {!isFinalized && (
                  <button 
                    onClick={() => {
                      const now = new Date().toTimeString().substring(0, 5);
                      update({ boxWeights: [...(report.boxWeights || []), { time: now, weight: 0 }] });
                    }}
                    className="flex items-center text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg"
                  >
                    <Plus size={16} className="mr-1" /> Adicionar
                  </button>
                )}
              </div>

              {(!report.boxWeights || report.boxWeights.length === 0) ? (
                <p className="text-neutral-500 text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">Nenhuma pesagem registrada.</p>
              ) : (
                <div className="space-y-4">
                  {report.boxWeights.map((item, index) => (
                    <div key={index} className="flex gap-4 p-4 border border-neutral-200 rounded-xl bg-neutral-50 items-center">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-neutral-500 mb-1">Hora</label>
                        <input 
                          type="time" 
                          value={item.time}
                          onChange={(e) => {
                            const newList = [...report.boxWeights];
                            newList[index].time = e.target.value;
                            update({ boxWeights: newList });
                          }}
                          disabled={isFinalized}
                          className="w-full p-2 border rounded-lg bg-white"
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
                          disabled={isFinalized}
                          className="w-full p-2 border rounded-lg bg-white"
                        />
                      </div>
                      {!isFinalized && (
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
              
              {!isFinalized && (
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-6">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Horário do Registro</label>
                    <input 
                      type="time" 
                      value={defectTime}
                      onChange={(e) => setDefectTime(e.target.value)}
                      className="w-full p-4 bg-white border border-neutral-300 rounded-xl font-bold text-lg" 
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
                    {!isFinalized && (
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
              
              {!isFinalized && (
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-6">
                  <textarea
                    id="new-obs"
                    className="w-full p-4 bg-white border border-neutral-300 rounded-xl mb-4 min-h-[120px] outline-none focus:border-orange-500"
                    placeholder="Registre informações sobre o processo, ocorrências e problemas encontrados durante o turno..."
                  />
                  <button 
                    onClick={() => {
                      const obs = (document.getElementById('new-obs') as HTMLTextAreaElement).value;
                      if (!obs) return;
                      const now = new Date().toTimeString().substring(0, 5);
                      update({ observations: [...report.observations, { time: now, description: obs }] });
                      (document.getElementById('new-obs') as HTMLTextAreaElement).value = '';
                    }}
                    className="w-full py-4 bg-neutral-800 text-white font-bold rounded-xl flex justify-center items-center active:bg-neutral-900"
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
                      {!isFinalized && (
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
                <button 
                  onClick={handleFinalize}
                  className="w-full py-5 bg-orange-500 text-white font-bold rounded-2xl flex justify-center items-center text-lg active:bg-orange-600 shadow-lg shadow-orange-200"
                >
                  <CheckCircle size={24} className="mr-2" /> Finalizar e Gerar PDF
                </button>
              ) : (
                <button 
                  onClick={() => generatePDF(report)}
                  className="w-full py-5 bg-neutral-900 text-white font-bold rounded-2xl flex justify-center items-center text-lg active:bg-black shadow-lg shadow-neutral-300"
                >
                  <FileDown size={24} className="mr-2" /> Baixar PDF Novamente
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

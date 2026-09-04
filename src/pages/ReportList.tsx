import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReportStore } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import { ChevronLeft, Search, FileText, CheckCircle, Clock, FileDown, BarChart2, Edit3, Eye, User as UserIcon, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { generatePDF } from '../lib/pdfGenerator';
import { canUserAccessReport } from '../lib/permissions';
import VivaLogo from '../components/VivaLogo';
import CloudSyncBadge from '../components/CloudSyncBadge';

export default function ReportList() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  
  const initialFilter = searchParams.get('filter') || (isAdmin ? 'finalizado' : 'all');
  const { reports, fetchFromCloud } = useReportStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState(initialFilter);

  // Sincroniza da nuvem com escopo de permissões do usuário
  useEffect(() => {
    if (user) {
      fetchFromCloud(user);
    }
  }, [user, fetchFromCloud]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // 1. Regra estrita de permissão:
      // - Administrador só tem acesso aos relatórios finalizados
      // - Líder só tem acesso aos seus próprios relatórios
      if (!canUserAccessReport(r, user)) {
        return false;
      }

      const matchesSearch =
        (r.line || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (r.format || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.leaderName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.date || '').includes(searchTerm);

      if (!matchesSearch) return false;

      if (isAdmin) {
        return r.status === 'FINALIZADO';
      }

      if (filter === 'em_andamento') return r.status === 'EM_ANDAMENTO';
      if (filter === 'finalizado') return r.status === 'FINALIZADO';
      return true;
    });
  }, [reports, searchTerm, filter, isAdmin, user]);

  // Summary for the 4 shifts (only calculated for admins based on current filtered view)
  const shiftSummary = useMemo(() => {
    const summary = {
      A: { reports: 0, defects: 0 },
      B: { reports: 0, defects: 0 },
      C: { reports: 0, defects: 0 },
      D: { reports: 0, defects: 0 },
    };

    if (!isAdmin) return summary;

    filteredReports.forEach(r => {
      const shift = r.shift as 'A' | 'B' | 'C' | 'D';
      if (summary[shift]) {
        summary[shift].reports += 1;
        summary[shift].defects += r.defects.reduce((acc, d) => acc + (Number(d.quantity) || 0), 0);
      }
    });

    return summary;
  }, [filteredReports, isAdmin]);

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <header className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-4 flex items-center z-10">
        <Link to="/" className="p-2 mr-2 bg-neutral-100 rounded-full">
          <ChevronLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {isAdmin ? 'Relatórios Finalizados' : 'Meus Relatórios'}
          </h1>
          <p className="text-[11px] text-neutral-500">
            {isAdmin
              ? 'Acesso exclusivo de administrador a relatórios finalizados'
              : `Listagem restrita ao usuário: ${user?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CloudSyncBadge showLabel={false} />
          <VivaLogo className="h-7 w-auto ml-1" variant="dark" />
        </div>
      </header>

      <div className="p-4">
        {/* Search & Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input 
              type="text" 
              placeholder={isAdmin ? "Buscar por líder, linha, formato, data..." : "Buscar por linha, formato, data..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-neutral-200 outline-none focus:border-orange-500 bg-white"
            />
          </div>

          {!isAdmin && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-semibold ${filter === 'all' ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilter('em_andamento')}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-semibold ${filter === 'em_andamento' ? 'bg-orange-500 text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              >
                Em Andamento
              </button>
              <button 
                onClick={() => setFilter('finalizado')}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-semibold ${filter === 'finalizado' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              >
                Finalizados
              </button>
            </div>
          )}
        </div>

        {/* Admin Summary */}
        {isAdmin && (
          <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-neutral-200">
            <h2 className="flex items-center font-bold text-neutral-800 mb-4 text-sm">
              <BarChart2 size={18} className="mr-2 text-orange-500" />
              Resumo Geral de Produção (Turnos)
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {['A', 'B', 'C', 'D'].map(shift => (
                <div key={shift} className="bg-neutral-50 border border-neutral-100 p-3 rounded-xl text-center">
                  <div className="text-xs font-bold text-neutral-500 mb-1">Turno {shift}</div>
                  <div className="text-xl font-black text-neutral-800">{shiftSummary[shift as 'A'|'B'|'C'|'D'].reports}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">finalizados</div>
                  <div className="text-xs font-semibold text-orange-600 mt-2 bg-orange-50 py-1 rounded">
                    {shiftSummary[shift as 'A'|'B'|'C'|'D'].defects} defeitos
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <div className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-semibold">Nenhum relatório encontrado.</p>
              <p className="text-xs text-neutral-400 mt-1">
                {isAdmin
                  ? 'Nenhum relatório finalizado registrado até o momento.'
                  : 'Você não possui relatórios correspondentes ao filtro.'}
              </p>
            </div>
          ) : (
            filteredReports.map(report => (
              <div 
                key={report.id} 
                className="block bg-white rounded-2xl p-5 shadow-sm border border-neutral-100"
              >
                <Link to={`/reports/edit/${report.id}`} className="block">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{format(new Date(report.date), 'dd/MM/yyyy')}</h3>
                      <p className="text-sm text-neutral-500">Turno {report.shift} • Linha {report.line || '-'}</p>
                    </div>
                    {report.status === 'FINALIZADO' ? (
                      <span className="flex items-center text-xs font-semibold text-orange-500 bg-neutral-900 px-2.5 py-1 rounded-full">
                        <CheckCircle size={12} className="mr-1" /> Finalizado
                      </span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                        <Clock size={12} className="mr-1" /> Em Andamento
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-neutral-600 border-t border-neutral-100 pt-3">
                    <div>
                      <span className="text-neutral-400 text-xs block">Formato</span>
                      {report.format || '-'}
                    </div>
                    <div>
                      <span className="text-neutral-400 text-xs block">Referência</span>
                      {report.reference || '-'}
                    </div>
                  </div>

                  {/* Exibição do Líder / Responsável */}
                  <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <UserIcon size={12} className="text-neutral-400" />
                      Líder: <strong className="text-neutral-700 font-semibold">{report.leaderName || 'Não informado'}</strong>
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded">
                        Liberado p/ ADM
                      </span>
                    )}
                  </div>
                </Link>
                
                <div className="flex gap-2 mt-4 pt-3 border-t border-neutral-100">
                  <Link
                    to={`/reports/edit/${report.id}${isAdmin ? '' : '?edit=true'}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                  >
                    {isAdmin ? (
                      <>
                        <Eye size={15} className="text-orange-400" />
                        <span>Visualizar / Consultar</span>
                      </>
                    ) : report.status === 'FINALIZADO' ? (
                      <>
                        <Edit3 size={15} className="text-orange-400" />
                        <span>Visualizar / Editar</span>
                      </>
                    ) : (
                      <>
                        <Edit3 size={15} className="text-orange-400" />
                        <span>Continuar Preenchimento</span>
                      </>
                    )}
                  </Link>

                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      generatePDF(report);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition-colors active:scale-95"
                  >
                    <FileDown size={15} />
                    <span>{report.status === 'FINALIZADO' ? 'Baixar PDF' : 'Prévia PDF'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

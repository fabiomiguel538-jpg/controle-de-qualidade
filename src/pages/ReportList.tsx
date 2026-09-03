import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReportStore } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import { ChevronLeft, Search, FileText, CheckCircle, Clock, FileDown, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { generatePDF } from '../lib/pdfGenerator';
import VivaLogo from '../components/VivaLogo';
import VivaLogo from '../components/VivaLogo';

export default function ReportList() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  
  const initialFilter = searchParams.get('filter') || (isAdmin ? 'finalizado' : 'all');
  const { reports } = useReportStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState(initialFilter);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = r.line.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.format.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            r.date.includes(searchTerm);
      
      // Admin only sees finalized reports
      if (isAdmin) {
        return matchesSearch && r.status === 'FINALIZADO';
      }

      if (filter === 'em_andamento') return matchesSearch && r.status === 'EM_ANDAMENTO';
      if (filter === 'finalizado') return matchesSearch && r.status === 'FINALIZADO';
      return matchesSearch;
    });
  }, [reports, searchTerm, filter, isAdmin]);

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
        <h1 className="text-xl font-bold flex-1">
          {isAdmin ? 'Relatórios Finalizados' : 'Histórico de Relatórios'}
        </h1>
        <VivaLogo className="h-7 w-auto ml-2" variant="dark" />
      </header>

      <div className="p-4">
        {/* Search & Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por linha, formato, data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-neutral-200 outline-none focus:border-orange-500 bg-white"
            />
          </div>

          {!isAdmin && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${filter === 'all' ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilter('em_andamento')}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${filter === 'em_andamento' ? 'bg-orange-500 text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              >
                Em Andamento
              </button>
              <button 
                onClick={() => setFilter('finalizado')}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${filter === 'finalizado' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              >
                Finalizados
              </button>
            </div>
          )}
        </div>

        {/* Admin Summary */}
        {isAdmin && (
          <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-neutral-200">
            <h2 className="flex items-center font-bold text-neutral-800 mb-4">
              <BarChart2 size={18} className="mr-2 text-orange-500" />
              Resumo Geral (Turnos)
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {['A', 'B', 'C', 'D'].map(shift => (
                <div key={shift} className="bg-neutral-50 border border-neutral-100 p-3 rounded-xl text-center">
                  <div className="text-sm font-bold text-neutral-500 mb-1">Turno {shift}</div>
                  <div className="text-xl font-black text-neutral-800">{shiftSummary[shift as 'A'|'B'|'C'|'D'].reports}</div>
                  <div className="text-xs text-neutral-500 mt-1">relatórios</div>
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
              <p>Nenhum relatório encontrado.</p>
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
                      <span className="flex items-center text-xs font-semibold text-orange-500 bg-neutral-900 px-2 py-1 rounded">
                        <CheckCircle size={12} className="mr-1" /> Finalizado
                      </span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded">
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
                </Link>
                
                {report.status === 'FINALIZADO' && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      generatePDF(report);
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition-colors"
                  >
                    <FileDown size={18} />
                    Baixar PDF
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

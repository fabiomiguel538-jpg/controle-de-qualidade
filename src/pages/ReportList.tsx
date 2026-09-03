import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReportStore } from '../store/reportStore';
import { ChevronLeft, Search, FileText, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function ReportList() {
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  const { reports } = useReportStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState(initialFilter);

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.line.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.format.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.date.includes(searchTerm);
    if (filter === 'em_andamento') return matchesSearch && r.status === 'EM_ANDAMENTO';
    if (filter === 'finalizado') return matchesSearch && r.status === 'FINALIZADO';
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <header className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-4 flex items-center z-10">
        <Link to="/" className="p-2 mr-2 bg-neutral-100 rounded-full">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold flex-1">Histórico de Relatórios</h1>
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
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-neutral-200 outline-none focus:border-blue-500 bg-white"
            />
          </div>

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
              className={`px-4 py-2 rounded-full whitespace-nowrap ${filter === 'finalizado' ? 'bg-blue-600 text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
            >
              Finalizados
            </button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhum relatório encontrado.</p>
            </div>
          ) : (
            filteredReports.map(report => (
              <Link 
                key={report.id} 
                to={`/reports/edit/${report.id}`}
                className="block bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 active:bg-neutral-50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{format(new Date(report.date), 'dd/MM/yyyy')}</h3>
                    <p className="text-sm text-neutral-500">Turno {report.shift} • Linha {report.line || '-'}</p>
                  </div>
                  {report.status === 'FINALIZADO' ? (
                    <span className="flex items-center text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}

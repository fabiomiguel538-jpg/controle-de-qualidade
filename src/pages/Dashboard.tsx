import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useReportStore } from '../store/reportStore';
import { FileText, Plus, FolderOpen, CheckCircle, BarChart3, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { reports } = useReportStore();

  const savedReports = reports.filter(r => r.status === 'EM_ANDAMENTO');
  const finishedReports = reports.filter(r => r.status === 'FINALIZADO');
  
  const today = new Date().toISOString().split('T')[0];
  const todayReports = reports.filter(r => r.date === today);

  // Quick stats
  const totalDefects = reports.reduce((acc, curr) => acc + curr.defects.reduce((sum, d) => sum + d.quantity, 0), 0);
  
  return (
    <div className="pb-24">
      {/* Header */}
      <header className="px-6 py-8 bg-neutral-900 text-white shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="VIVA" 
              className="h-10 bg-white px-2 py-1 rounded object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <h1 className="text-xl font-bold">Painel de Produção</h1>
          </div>
          <button onClick={logout} className="p-2 bg-neutral-800 rounded-full hover:bg-black transition-colors">
            <LogOut size={20} />
          </button>
        </div>
        <p className="text-orange-500 text-sm">Bem-vindo(a),</p>
        <p className="text-2xl font-semibold">{user?.name}</p>
        <p className="text-sm mt-1">{user?.role === 'LIDER' ? 'Líder de Turno' : 'Administrador'}</p>
      </header>

      <main className="p-4 -mt-6">
        {/* Main Actions */}
        {user?.role !== 'ADMIN' && (
          <div className="grid grid-cols-1 gap-4 mb-8">
            <Link
              to="/reports/new"
              className="flex items-center p-6 bg-white rounded-2xl shadow-sm border border-neutral-100 active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-center w-14 h-14 bg-neutral-100 text-orange-600 rounded-full mr-4">
                <Plus size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-800">Novo Relatório</h2>
                <p className="text-neutral-500 text-sm mt-1">Iniciar preenchimento do turno</p>
              </div>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          {user?.role !== 'ADMIN' && (
            <Link
              to="/reports/list?filter=em_andamento"
              className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 active:scale-95 transition-transform"
            >
              <FolderOpen size={32} className="text-orange-500 mb-2" />
              <h3 className="font-semibold text-neutral-800">Em Andamento</h3>
              <span className="text-2xl font-bold mt-1">{savedReports.length}</span>
            </Link>
          )}

          <Link
            to="/reports/list?filter=finalizado"
            className={`flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 active:scale-95 transition-transform ${user?.role === 'ADMIN' ? 'col-span-2' : ''}`}
          >
            <CheckCircle size={32} className="text-neutral-900 mb-2" />
            <h3 className="font-semibold text-neutral-800">Finalizados</h3>
            <span className="text-2xl font-bold mt-1">{finishedReports.length}</span>
          </Link>
        </div>

        {/* Dashboard Stats */}
        <h3 className="text-lg font-bold text-neutral-800 mb-4 px-2">Resumo Geral</h3>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center text-neutral-600">
              <FileText size={20} className="mr-3 text-neutral-900" />
              <span>Relatórios hoje</span>
            </div>
            <span className="font-bold text-xl">{todayReports.length}</span>
          </div>
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center text-neutral-600">
              <BarChart3 size={20} className="mr-3 text-red-500" />
              <span>Total de Defeitos (Geral)</span>
            </div>
            <span className="font-bold text-xl">{totalDefects}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useReportStore } from '../store/reportStore';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';

interface CloudSyncBadgeProps {
  showLabel?: boolean;
  className?: string;
}

export default function CloudSyncBadge({ showLabel = true, className = '' }: CloudSyncBadgeProps) {
  const { isSyncing, cloudConnected, lastSyncedAt, fetchFromCloud, syncPendingReports } = useReportStore();

  const handleManualSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fetchFromCloud();
    syncPendingReports();
  };

  if (isSyncing) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-sm ${className}`}
        title="Sincronizando com a nuvem..."
      >
        <RefreshCw size={13} className="animate-spin text-amber-600" />
        {showLabel && <span>Sincronizando...</span>}
      </div>
    );
  }

  if (!cloudConnected) {
    return (
      <button
        onClick={handleManualSync}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-300 hover:bg-neutral-200 transition-colors shadow-sm ${className}`}
        title="Offline. Clique para tentar reconectar à nuvem."
      >
        <CloudOff size={13} className="text-neutral-500" />
        {showLabel && <span>Offline (Salvo no aparelho)</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleManualSync}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm ${className}`}
      title={lastSyncedAt ? `Salvo na Nuvem (Última sincronização: ${lastSyncedAt}). Clique para atualizar.` : 'Salvo na Nuvem. Clique para atualizar.'}
    >
      <Cloud size={13} className="text-emerald-600" />
      {showLabel && (
        <span className="flex items-center gap-1">
          <span>Nuvem Ativa</span>
          <Check size={11} className="text-emerald-600 stroke-[3]" />
        </span>
      )}
    </button>
  );
}

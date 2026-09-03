import { useReportStore } from '../store/reportStore';
import { Cloud, CloudOff, RefreshCw, Check, UploadCloud } from 'lucide-react';

interface CloudSyncBadgeProps {
  showLabel?: boolean;
  className?: string;
}

export default function CloudSyncBadge({ showLabel = true, className = '' }: CloudSyncBadgeProps) {
  const { reports, isSyncing, cloudConnected, lastSyncedAt, syncPendingReports } = useReportStore();

  const pendingCount = reports.filter((r) => r.syncStatus === 'pending').length;

  const handleManualSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isSyncing) return;
    syncPendingReports();
  };

  if (isSyncing) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 shadow-sm ${className}`}
        title="Enviando dados para a nuvem..."
      >
        <RefreshCw size={13} className="animate-spin text-amber-600" />
        {showLabel && <span>Enviando dados...</span>}
      </div>
    );
  }

  if (!cloudConnected) {
    return (
      <button
        onClick={handleManualSync}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200 transition-colors shadow-sm active:scale-95 ${className}`}
        title="Modo local. Toque para tentar enviar os dados para a nuvem."
      >
        <CloudOff size={13} className="text-neutral-500" />
        {showLabel && (
          <span>{pendingCount > 0 ? `Enviar (${pendingCount})` : 'Offline • Conectar'}</span>
        )}
      </button>
    );
  }

  // If there are pending changes to send to cloud
  if (pendingCount > 0) {
    return (
      <button
        onClick={handleManualSync}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-sm transition-all active:scale-95 animate-pulse ${className}`}
        title={`Existem ${pendingCount} alteração(ões) pendentes. Toque para enviar para a nuvem.`}
      >
        <UploadCloud size={14} />
        {showLabel && <span>Enviar Dados ({pendingCount})</span>}
      </button>
    );
  }

  // All reports are synced
  return (
    <button
      onClick={handleManualSync}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-sm active:scale-95 ${className}`}
      title={
        lastSyncedAt
          ? `Nuvem atualizada (Último envio: ${lastSyncedAt}). Toque para sincronizar agora.`
          : 'Nuvem atualizada. Toque para sincronizar agora.'
      }
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

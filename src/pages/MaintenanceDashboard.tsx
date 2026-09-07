import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { MaintenanceReplacement } from '../types';
import {
  Wrench,
  Plus,
  ArrowLeft,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  User,
  Layers,
  Settings2,
  Trash2,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
  ChevronRight,
  History,
  Info,
  Edit2,
  Check,
  X,
  Tag
} from 'lucide-react';
import VivaLogo from '../components/VivaLogo';

const DEFAULT_SECTORS = ['Prensas', 'Linha de Esmaltação', 'Forno', 'Retífica'];

// Helper para calcular datas sem erro de fuso horário
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '--/--/----';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function MaintenanceDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    replacements,
    sectors,
    addReplacement,
    updateReplacement,
    deleteReplacement,
    isSyncing,
    cloudConnected,
    lastSyncedAt,
    fetchReplacements,
    fetchSectors,
    addSector,
    editSector,
    deleteSector,
    syncPendingReplacements,
  } = useMaintenanceStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReplacementId, setEditingReplacementId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sector Management Modal State
  const [isSectorsModalOpen, setIsSectorsModalOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [editingSectorOldName, setEditingSectorOldName] = useState<string | null>(null);
  const [editingSectorNewName, setEditingSectorNewName] = useState('');
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [sectorSuccess, setSectorSuccess] = useState<string | null>(null);

  // Inline Sector Addition inside Replacement Form
  const [isAddingNewSectorInline, setIsAddingNewSectorInline] = useState(false);
  const [inlineNewSector, setInlineNewSector] = useState('');

  // Form State
  const [formSector, setFormSector] = useState<string>(sectors[0] || 'Prensas');
  const [formMachine, setFormMachine] = useState<string>('');
  const [formComponentName, setFormComponentName] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(getTodayString());
  const [formLifespan, setFormLifespan] = useState<number>(60);
  const [formAlertLead, setFormAlertLead] = useState<number>(7);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincronização em tempo real multi-dispositivo (SSE push imediato + polling 4s + foco/visibilidade)
  useEffect(() => {
    // Busca inicial imediata
    fetchReplacements();
    fetchSectors();

    // 1. Canal Server-Sent Events (SSE) para atualização instantânea entre dispositivos (< 100ms)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/maintenance/stream');
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type !== 'CONNECTED') {
            fetchReplacements();
            fetchSectors();
          }
        } catch {
          // heartbeat ou parse ignorado
        }
      };
      eventSource.onerror = () => {
        // Reconexão automática gerenciada pelo navegador
      };
    } catch (err) {
      console.warn('SSE stream não disponível:', err);
    }

    // 2. Polling ativo contínuo a cada 4 segundos (garantia contra redes instáveis em celular)
    const interval = setInterval(() => {
      fetchReplacements();
      fetchSectors();
    }, 4000);

    // 3. Atualização instantânea ao alternar de aba, destravar a tela do celular ou reconectar à internet
    const handleImmediateSync = () => {
      fetchReplacements();
      fetchSectors();
      syncPendingReplacements();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleImmediateSync();
      }
    };

    window.addEventListener('focus', handleImmediateSync);
    window.addEventListener('online', handleImmediateSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      window.removeEventListener('focus', handleImmediateSync);
      window.removeEventListener('online', handleImmediateSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchReplacements, fetchSectors, syncPendingReplacements]);

  // Keep formSector in sync if sectors change and current formSector is not in list
  useEffect(() => {
    if (sectors.length > 0 && !sectors.includes(formSector)) {
      setFormSector(sectors[0]);
    }
  }, [sectors, formSector]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleOpenNewModal = (prefill?: Partial<MaintenanceReplacement>) => {
    setIsAddingNewSectorInline(false);
    setInlineNewSector('');
    setEditingReplacementId(null);
    if (prefill) {
      setFormSector(prefill.sector || sectors[0] || 'Prensas');
      setFormMachine(prefill.machine || '');
      setFormComponentName(prefill.component_name || '');
      setFormLifespan(prefill.lifespan_days || 60);
      setFormAlertLead(prefill.alert_lead_days || 7);
      setFormNotes(`Renovação preventiva após ciclo anterior. ${prefill.notes ? `(Obs anterior: ${prefill.notes})` : ''}`);
    } else {
      setFormSector(sectors[0] || 'Prensas');
      setFormMachine('');
      setFormComponentName('');
      setFormLifespan(60);
      setFormAlertLead(7);
      setFormNotes('');
    }
    setFormDate(getTodayString());
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: MaintenanceReplacement) => {
    setIsAddingNewSectorInline(false);
    setInlineNewSector('');
    setEditingReplacementId(item.id);
    setFormSector(item.sector);
    setFormMachine(item.machine);
    setFormComponentName(item.component_name);
    setFormDate(item.replacement_date);
    setFormLifespan(item.lifespan_days);
    setFormAlertLead(item.alert_lead_days);
    setFormNotes(item.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Sector Handlers
  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectorError(null);
    setSectorSuccess(null);
    const trimmed = newSectorName.trim();
    if (!trimmed) {
      setSectorError('Digite um nome para o setor.');
      return;
    }
    try {
      await addSector(trimmed);
      setNewSectorName('');
      setSectorSuccess(`Setor "${trimmed}" cadastrado com sucesso!`);
      showToast(`Setor "${trimmed}" cadastrado!`);
    } catch (err: any) {
      setSectorError(err.message || 'Erro ao cadastrar setor.');
    }
  };

  const handleStartEditSector = (name: string) => {
    setEditingSectorOldName(name);
    setEditingSectorNewName(name);
    setSectorError(null);
    setSectorSuccess(null);
  };

  const handleSaveEditSector = async (oldName: string) => {
    setSectorError(null);
    setSectorSuccess(null);
    const trimmed = editingSectorNewName.trim();
    if (!trimmed) {
      setSectorError('O nome do setor não pode ficar vazio.');
      return;
    }
    if (trimmed === oldName) {
      setEditingSectorOldName(null);
      return;
    }
    try {
      await editSector(oldName, trimmed);
      setEditingSectorOldName(null);
      setSectorSuccess(`Setor renomeado para "${trimmed}" com sucesso!`);
      showToast(`Setor renomeado para "${trimmed}"!`);
      if (selectedSector === oldName) {
        setSelectedSector(trimmed);
      }
    } catch (err: any) {
      setSectorError(err.message || 'Erro ao renomear setor.');
    }
  };

  const handleDeleteSector = async (name: string) => {
    setSectorError(null);
    setSectorSuccess(null);
    const res = await deleteSector(name);
    if (!res.success) {
      setSectorError(res.message || 'Não foi possível excluir o setor.');
    } else {
      setSectorSuccess(`Setor "${name}" removido.`);
      showToast(`Setor "${name}" removido!`);
      if (selectedSector === name) {
        setSelectedSector('all');
      }
    }
  };

  const handleSaveInlineSector = async () => {
    const trimmed = inlineNewSector.trim();
    if (!trimmed) {
      setFormError('Digite um nome para o novo setor.');
      return;
    }
    try {
      await addSector(trimmed);
      setFormSector(trimmed);
      setInlineNewSector('');
      setIsAddingNewSectorInline(false);
      showToast(`Setor "${trimmed}" cadastrado e selecionado!`);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao cadastrar setor.');
    }
  };

  const handleSaveReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMachine.trim() || !formComponentName.trim()) {
      setFormError('Preencha a máquina e o nome do componente.');
      return;
    }
    if (!formLifespan || formLifespan <= 0) {
      setFormError('Informe uma durabilidade estimada válida em dias.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingReplacementId) {
        await updateReplacement(editingReplacementId, {
          sector: formSector,
          machine: formMachine.trim(),
          component_name: formComponentName.trim(),
          replacement_date: formDate,
          lifespan_days: Number(formLifespan),
          alert_lead_days: Number(formAlertLead) || 7,
          notes: formNotes.trim(),
        });
        showToast(`Componente "${formComponentName.trim()}" atualizado com sucesso!`);
      } else {
        await addReplacement({
          sector: formSector,
          machine: formMachine.trim(),
          component_name: formComponentName.trim(),
          replacement_date: formDate,
          mechanic_name: user?.name || 'Mecânico 1',
          lifespan_days: Number(formLifespan),
          alert_lead_days: Number(formAlertLead) || 7,
          notes: formNotes.trim(),
        });
        showToast('Nova troca de componente registrada com sucesso!');
      }

      setIsModalOpen(false);
      setEditingReplacementId(null);
    } catch (err: any) {
      setFormError('Erro ao salvar no banco online. Verifique a conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Deseja remover o registro de monitoramento de "${name}"?`)) {
      await deleteReplacement(id);
      showToast('Registro de componente removido.');
    }
  };

  // Processamento e cálculo de status dos componentes
  const processedItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return replacements.map((item) => {
      const repDate = parseDate(item.replacement_date);
      repDate.setHours(0, 0, 0, 0);

      // Data de Vencimento = replacement_date + lifespan_days
      const dueDate = new Date(repDate);
      dueDate.setDate(dueDate.getDate() + Number(item.lifespan_days));

      // Dias restantes
      const diffMs = dueDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Dias em operação
      const elapsedMs = today.getTime() - repDate.getTime();
      const daysElapsed = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));

      const percentElapsed = Math.min(
        100,
        Math.max(0, Math.round((daysElapsed / item.lifespan_days) * 100))
      );

      let status: 'OVERDUE' | 'WARNING' | 'OK';
      if (daysRemaining <= 0) {
        status = 'OVERDUE';
      } else if (daysRemaining <= (item.alert_lead_days || 7)) {
        status = 'WARNING';
      } else {
        status = 'OK';
      }

      const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

      return {
        ...item,
        dueDateStr,
        daysRemaining,
        daysElapsed,
        percentElapsed,
        status,
      };
    });
  }, [replacements]);

  // Contadores e métricas
  const metrics = useMemo(() => {
    const total = processedItems.length;
    const overdue = processedItems.filter((i) => i.status === 'OVERDUE').length;
    const warning = processedItems.filter((i) => i.status === 'WARNING').length;
    const ok = processedItems.filter((i) => i.status === 'OK').length;
    return { total, overdue, warning, ok };
  }, [processedItems]);

  // Filtros aplicados
  const filteredItems = useMemo(() => {
    return processedItems.filter((item) => {
      const matchSector = selectedSector === 'all' || item.sector === selectedSector;
      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'overdue' && item.status === 'OVERDUE') ||
        (selectedStatus === 'warning' && item.status === 'WARNING') ||
        (selectedStatus === 'ok' && item.status === 'OK');

      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.component_name.toLowerCase().includes(q) ||
        item.machine.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q) ||
        item.mechanic_name.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchSector && matchStatus && matchSearch;
    });
  }, [processedItems, selectedSector, selectedStatus, searchTerm]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-16">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-neutral-950 font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-300 animate-in fade-in duration-200">
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Industrial Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left: Navigation back & Title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-bold border border-neutral-700 transition-all active:scale-95 cursor-pointer"
                title="Sair e escolher outro painel"
              >
                <ArrowLeft size={15} />
                <span>Voltar / Selecionar Outro Painel</span>
              </button>

              <div className="h-6 w-px bg-neutral-800 hidden sm:block" />

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Wrench size={20} />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-wide text-neutral-100 flex items-center gap-2">
                    Painel da Manutenção Mecânica
                  </h1>
                  <p className="text-xs text-neutral-400">
                    Viva Cerâmica • Monitoramento de Peças & Durabilidade
                  </p>
                </div>
              </div>
            </div>

            {/* Right: User badge, status & action */}
            <div className="flex items-center gap-2.5 justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-300">
                  <User size={13} className="text-orange-400" />
                  <span>{user?.name || 'Mecânico'}</span>
                </span>

                <button
                  type="button"
                  onClick={async () => {
                    await Promise.all([fetchReplacements(), fetchSectors(), syncPendingReplacements()]);
                    showToast('Painel sincronizado com a nuvem!');
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    cloudConnected
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50'
                      : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/50'
                  }`}
                  title="Clique para sincronizar agora com o banco de dados online (Neon DB)"
                >
                  <RefreshCw
                    size={11}
                    className={`${isSyncing ? 'animate-spin text-orange-400' : cloudConnected ? 'text-emerald-400' : 'text-amber-400'}`}
                  />
                  <span>
                    {isSyncing
                      ? 'Sincronizando...'
                      : cloudConnected
                      ? `Online (Nuvem) • ${lastSyncedAt || 'Ao vivo'}`
                      : 'Offline • Reconectar'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOpenNewModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-neutral-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={16} strokeWidth={3} />
                <span>Registrar Nova Troca</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        {/* Real-time Multi-Device Sync Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 mb-5 bg-neutral-900/60 border border-neutral-800/80 rounded-xl text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-neutral-300 font-semibold">
              Sincronização Online Ativa
            </span>
            <span className="hidden md:inline text-neutral-600">•</span>
            <span className="hidden md:inline text-neutral-400">
              Alterações feitas no celular, tablet ou computador salvam diretamente no banco online (Neon DB) e atualizam em tempo real em todas as telas.
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto text-[11px] text-neutral-400">
            <span>Última sincronia: <strong className="text-emerald-400 font-mono">{lastSyncedAt || 'Ao vivo'}</strong></span>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Total */}
          <div
            onClick={() => setSelectedStatus('all')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedStatus === 'all'
                ? 'bg-neutral-900 border-orange-500/70 shadow-lg shadow-orange-500/5'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-neutral-400">Total Monitorado</span>
              <Layers size={16} className="text-neutral-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-neutral-100">{metrics.total}</p>
            <span className="text-[11px] text-neutral-500">Componentes ativos</span>
          </div>

          {/* Vencidos */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'overdue' ? 'all' : 'overdue')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedStatus === 'overdue'
                ? 'bg-red-950/40 border-red-500 shadow-lg shadow-red-500/10'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-red-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-red-400">Vencidos (Troca Imediata)</span>
              <XCircle size={16} className="text-red-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-red-400">{metrics.overdue}</p>
            <span className="text-[11px] text-red-400/70">Excederam a durabilidade</span>
          </div>

          {/* Troca Próxima */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'warning' ? 'all' : 'warning')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedStatus === 'warning'
                ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-amber-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-400">Atenção / Troca Próxima</span>
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-400">{metrics.warning}</p>
            <span className="text-[11px] text-amber-400/70">Dentro do prazo de alerta</span>
          </div>

          {/* OK */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'ok' ? 'all' : 'ok')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedStatus === 'ok'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-emerald-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-400">Em Dia (OK)</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400">{metrics.ok}</p>
            <span className="text-[11px] text-emerald-400/70">Dentro da vida útil</span>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar componente, máquina, setor ou mecânico..."
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-colors"
              />
            </div>

            {/* Sector Selector Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedSector('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedSector === 'all'
                    ? 'bg-orange-500 text-neutral-950'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                }`}
              >
                Todos os Setores
              </button>
              {sectors.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSector(sec)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedSector === sec
                      ? 'bg-orange-500 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  {sec}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSectorError(null);
                  setSectorSuccess(null);
                  setIsSectorsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-neutral-800/90 border border-neutral-700 hover:border-orange-500/70 text-neutral-300 hover:text-orange-400 transition-all ml-1 shadow-sm"
                title="Adicionar, renomear ou remover setores"
              >
                <Tag size={13} className="text-orange-400" />
                <span>Gerenciar Setores</span>
              </button>
            </div>
          </div>

          {/* Secondary Filter Tags */}
          <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
            <span>
              Exibindo <strong className="text-neutral-200">{filteredItems.length}</strong> de{' '}
              <strong className="text-neutral-200">{processedItems.length}</strong> componentes
            </span>
            {selectedStatus !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedStatus('all')}
                className="text-orange-400 hover:underline font-semibold"
              >
                Limpar filtro de status ({selectedStatus.toUpperCase()})
              </button>
            )}
          </div>
        </section>

        {/* Components Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/40 border border-neutral-800/60 rounded-3xl p-8">
            <Wrench className="mx-auto mb-3 text-neutral-600" size={44} />
            <h3 className="text-base font-bold text-neutral-300">Nenhum componente encontrado</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 mb-4">
              Não encontramos registros com os filtros atuais. Tente buscar outro termo ou cadastre uma nova troca.
            </p>
            <button
              type="button"
              onClick={() => handleOpenNewModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-neutral-950 font-bold text-xs rounded-xl"
            >
              <Plus size={15} />
              <span>Registrar Nova Troca</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const isOverdue = item.status === 'OVERDUE';
              const isWarning = item.status === 'WARNING';
              const isOk = item.status === 'OK';

              return (
                <div
                  key={item.id}
                  className={`bg-neutral-900 rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-xl ${
                    isOverdue
                      ? 'border-red-500/60 bg-gradient-to-b from-red-950/20 to-neutral-900'
                      : isWarning
                      ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 to-neutral-900'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    {/* Header: Sector & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {item.sector}
                        </span>
                        <h4 className="text-sm font-black text-orange-400 mt-1.5">
                          {item.machine}
                        </h4>
                      </div>

                      {/* Status Badge */}
                      {isOverdue && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-500 text-white shadow-md shadow-red-500/20">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          🔴 Vencido
                        </span>
                      )}
                      {isWarning && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20">
                          🟡 Troca Próxima
                        </span>
                      )}
                      {isOk && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          🟢 OK (Em Dia)
                        </span>
                      )}
                    </div>

                    {/* Component Name */}
                    <h3 className="text-base font-bold text-neutral-100 leading-snug mb-3">
                      {item.component_name}
                    </h3>

                    {/* Progress Bar of Lifespan */}
                    <div className="mb-4">
                      <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                        <span>Vida útil consumida</span>
                        <span className="font-bold text-neutral-300">
                          {item.daysElapsed} de {item.lifespan_days} dias ({item.percentElapsed}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isOverdue
                              ? 'bg-red-500'
                              : isWarning
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, item.percentElapsed)}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta Dates Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 text-xs mb-3">
                      <div>
                        <span className="text-neutral-500 block text-[10px] uppercase font-semibold">
                          Última Troca
                        </span>
                        <span className="font-bold text-neutral-200">
                          {formatDateBR(item.replacement_date)}
                        </span>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[10px] uppercase font-semibold">
                          Previsão Vencimento
                        </span>
                        <span
                          className={`font-bold ${
                            isOverdue
                              ? 'text-red-400'
                              : isWarning
                              ? 'text-amber-400'
                              : 'text-neutral-200'
                          }`}
                        >
                          {formatDateBR(item.dueDateStr)}
                        </span>
                      </div>

                      <div className="col-span-2 pt-1.5 border-t border-neutral-800/60 flex items-center justify-between">
                        <span className="text-neutral-400 text-[11px]">
                          {isOverdue ? (
                            <strong className="text-red-400">
                              Vencido há {Math.abs(item.daysRemaining)} dia(s)
                            </strong>
                          ) : (
                            <span>
                              Restam:{' '}
                              <strong
                                className={isWarning ? 'text-amber-400' : 'text-emerald-400'}
                              >
                                {item.daysRemaining} dia(s)
                              </strong>
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          Aviso: {item.alert_lead_days}d antes
                        </span>
                      </div>
                    </div>

                    {/* Notes if available */}
                    {item.notes && (
                      <p className="text-xs text-neutral-400 italic bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800/50 mb-3 line-clamp-2">
                        "{item.notes}"
                      </p>
                    )}

                    {/* Mechanic Name */}
                    <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mb-3">
                      <User size={12} className="text-neutral-400" />
                      <span>Responsável: <strong className="text-neutral-300">{item.mechanic_name}</strong></span>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="py-2 px-2.5 bg-neutral-800 hover:bg-neutral-750 hover:border-neutral-600 text-neutral-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-95 border border-neutral-700/80"
                      title="Editar informações deste componente (máquina, durabilidade, etc.)"
                    >
                      <Edit2 size={13} className="text-amber-400" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenNewModal(item)}
                      className="flex-1 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-95"
                      title="Registrar que esta peça foi trocada novamente hoje"
                    >
                      <History size={13} className="text-orange-400" />
                      <span>Renovar Troca</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.component_name)}
                      className="p-2 bg-neutral-800/50 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 rounded-xl transition-colors active:scale-95"
                      title="Excluir este componente"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Registrar Nova Troca */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  {editingReplacementId ? <Edit2 size={18} /> : <Wrench size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100">
                    {editingReplacementId ? 'Editar Informações do Componente' : 'Registrar Troca de Peça'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {editingReplacementId
                      ? 'Altere máquina, durabilidade ou notas (sincroniza online)'
                      : 'Insira os dados técnicos para monitorar a durabilidade'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveReplacement} className="p-4 sm:p-5 space-y-3.5 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs">
                  {formError}
                </div>
              )}

              {/* 1. Setor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-300 font-bold">Setor *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewSectorInline(!isAddingNewSectorInline);
                      setInlineNewSector('');
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus size={13} />
                    <span>{isAddingNewSectorInline ? 'Selecionar existente' : '+ Criar novo setor'}</span>
                  </button>
                </div>

                {isAddingNewSectorInline ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inlineNewSector}
                      onChange={(e) => setInlineNewSector(e.target.value)}
                      placeholder="Nome do novo setor (ex: Atomizadores, Moinhos...)"
                      className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none text-xs sm:text-sm"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveInlineSector}
                      className="px-3.5 bg-orange-500 hover:bg-orange-600 text-neutral-950 font-bold rounded-xl text-xs transition-colors whitespace-nowrap"
                    >
                      Adicionar
                    </button>
                  </div>
                ) : (
                  <select
                    value={formSector}
                    onChange={(e) => setFormSector(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none"
                    required
                  >
                    {sectors.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Máquina / Equipamento */}
              <div>
                <label className="block text-neutral-300 font-bold mb-1">
                  Máquina / Equipamento *
                </label>
                <input
                  type="text"
                  value={formMachine}
                  onChange={(e) => setFormMachine(e.target.value)}
                  placeholder="Ex: Prensa 02, Campana Linha 1, Forno 01..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none"
                  required
                />
              </div>

              {/* 3. Nome do Componente / Peça */}
              <div>
                <label className="block text-neutral-300 font-bold mb-1">
                  Nome do Componente / Peça *
                </label>
                <input
                  type="text"
                  value={formComponentName}
                  onChange={(e) => setFormComponentName(e.target.value)}
                  placeholder="Ex: Rolamento 6205 DDU, Correia B-75, Rebolo..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none"
                  required
                />
              </div>

              {/* 4. Data da Troca & Mecânico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    Data da Troca *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    Mecânico Responsável
                  </label>
                  <input
                    type="text"
                    value={user?.name || 'Mecânico 1'}
                    disabled
                    className="w-full bg-neutral-950/50 border border-neutral-800/80 rounded-xl p-2.5 text-neutral-400 outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 5. Durabilidade & Janela de Aviso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    Durabilidade Estimada (Dias) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formLifespan}
                    onChange={(e) => setFormLifespan(Number(e.target.value))}
                    placeholder="Ex: 60"
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none font-bold"
                    required
                  />
                  <span className="text-[10px] text-neutral-500 mt-0.5 block">
                    Dias estimados até a próxima troca
                  </span>
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    Janela de Aviso Prévio (Dias)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formAlertLead}
                    onChange={(e) => setFormAlertLead(Number(e.target.value))}
                    placeholder="Padrão: 7"
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none font-bold"
                  />
                  <span className="text-[10px] text-neutral-500 mt-0.5 block">
                    Alerta amarelo antes do vencimento
                  </span>
                </div>
              </div>

              {/* 6. Observação Técnica */}
              <div>
                <label className="block text-neutral-300 font-bold mb-1">
                  Observação Técnica (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Detalhes sobre folgas, motivos da troca ou calibragem..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-5 bg-orange-500 hover:bg-orange-600 text-neutral-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Salvando na nuvem...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{editingReplacementId ? 'Salvar Alterações (Nuvem)' : 'Salvar Registro de Troca'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sector Management Modal */}
      {isSectorsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100">
                    Gerenciamento de Setores Fabris
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Adicione, renomeie ou remova setores da manutenção
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSectorsModalOpen(false);
                  setEditingSectorOldName(null);
                  setSectorError(null);
                  setSectorSuccess(null);
                }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {/* Feedback messages */}
              {sectorError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-red-400" />
                  <span>{sectorError}</span>
                </div>
              )}
              {sectorSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                  <span>{sectorSuccess}</span>
                </div>
              )}

              {/* Form Add New Sector */}
              <form onSubmit={handleAddSector} className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-300">
                  Cadastrar Novo Setor
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSectorName}
                    onChange={(e) => setNewSectorName(e.target.value)}
                    placeholder="Ex: Atomizadores, Moagem, Paletizadora..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl p-2.5 text-neutral-200 outline-none text-xs sm:text-sm"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-neutral-950 font-bold rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Plus size={16} strokeWidth={3} />
                    <span>Adicionar</span>
                  </button>
                </div>
              </form>

              {/* Active Sectors List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Setores Ativos ({sectors.length})
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Clique no lápis para editar o nome
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {sectors.map((sec) => {
                    const count = replacements.filter((r) => r.sector === sec).length;
                    const isEditing = editingSectorOldName === sec;

                    return (
                      <div
                        key={sec}
                        className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700 transition-all"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input
                              type="text"
                              value={editingSectorNewName}
                              onChange={(e) => setEditingSectorNewName(e.target.value)}
                              className="flex-1 bg-neutral-900 border border-orange-500 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditSector(sec);
                                if (e.key === 'Escape') setEditingSectorOldName(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditSector(sec)}
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                              title="Salvar alteração"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSectorOldName(null)}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 transition-colors"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-semibold text-neutral-200">{sec}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                count > 0
                                  ? 'bg-neutral-800 text-neutral-400'
                                  : 'bg-neutral-800/40 text-neutral-500'
                              }`}
                            >
                              {count} {count === 1 ? 'peça' : 'peças'}
                            </span>
                          </div>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditSector(sec)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-400 hover:bg-neutral-800 transition-colors"
                              title="Editar / Renomear setor"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSector(sec)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                              title={
                                count > 0
                                  ? `Possui ${count} peça(s) vinculada(s)`
                                  : 'Excluir setor'
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informative Note */}
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2">
                <Info size={14} className="text-orange-400 mt-0.5 shrink-0" />
                <span>
                  <strong>Atualização Automática:</strong> Ao renomear um setor, todos os registros e histórico de trocas vinculadas a ele serão sincronizados para o novo nome imediatamente.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-800 flex justify-end bg-neutral-950/40">
              <button
                type="button"
                onClick={() => {
                  setIsSectorsModalOpen(false);
                  setEditingSectorOldName(null);
                  setSectorError(null);
                  setSectorSuccess(null);
                }}
                className="py-2 px-5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs sm:text-sm rounded-xl transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

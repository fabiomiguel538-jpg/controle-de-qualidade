import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Wrench,
  ClipboardList,
  Flame,
  Maximize2,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import VivaLogo from '../components/VivaLogo';

type PanelKey = 'manutencao' | 'producao' | 'forno' | 'retifica';

interface PanelOption {
  key: PanelKey;
  title: string;
  subtitle: string;
  icon: typeof Wrench;
  badge: string;
  targetRoute: string;
  accentColor: string;
  cardBorder: string;
  cardBg: string;
}

const PANELS: PanelOption[] = [
  {
    key: 'manutencao',
    title: '🛠️ Manutenção Mecânica',
    subtitle: 'Trocas preventivas de peças, vida útil e alertas de vencimento',
    icon: Wrench,
    badge: 'Mecânicos',
    targetRoute: '/manutencao',
    accentColor: 'from-orange-500 to-amber-600',
    cardBorder: 'border-orange-500/50 hover:border-orange-400',
    cardBg: 'bg-neutral-900/90 hover:bg-neutral-850',
  },
  {
    key: 'producao',
    title: '📋 Controle de Produção',
    subtitle: 'Inspeções dimensionais, espessura, empeno, perdas e turnos',
    icon: ClipboardList,
    badge: 'Líderes & Qualidade',
    targetRoute: '/producao',
    accentColor: 'from-emerald-500 to-teal-600',
    cardBorder: 'border-neutral-700 hover:border-emerald-500/60',
    cardBg: 'bg-neutral-900/90 hover:bg-neutral-850',
  },
  {
    key: 'forno',
    title: '🔥 Setor do Forno',
    subtitle: 'Controle de queima, curva térmica, pressão e roletes cerâmicos',
    icon: Flame,
    badge: 'Operação Térmica',
    targetRoute: '/producao',
    accentColor: 'from-red-500 to-orange-600',
    cardBorder: 'border-neutral-700 hover:border-red-500/60',
    cardBg: 'bg-neutral-900/90 hover:bg-neutral-850',
  },
  {
    key: 'retifica',
    title: '📐 Retífica de Piso',
    subtitle: 'Esquadro, planaridade, bisotamento e desgaste de rebolos',
    icon: Maximize2,
    badge: 'Acabamento',
    targetRoute: '/producao',
    accentColor: 'from-blue-500 to-cyan-600',
    cardBorder: 'border-neutral-700 hover:border-blue-500/60',
    cardBg: 'bg-neutral-900/90 hover:bg-neutral-850',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const setSelectedPanelStore = useAuthStore((state) => state.setSelectedPanel);

  // Painel pré-selecionado (ou nulo se na Etapa A)
  const queryPanel = searchParams.get('panel') as PanelKey | null;
  const [selectedPanel, setSelectedPanel] = useState<PanelKey | null>(queryPanel || null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Usuários de fallback / mock para offline ou sem Neon DB
  const mockUsers: Record<string, any> = {
    'mecanico1': { name: 'Mecânico 1', pass: '741741', role: 'mechanic', panel: 'manutencao' },
    'mecanico 1': { name: 'Mecânico 1', pass: '741741', role: 'mechanic', panel: 'manutencao' },
    'admin': { name: 'Administrador', pass: '741741', role: 'ADMIN', panel: 'producao' },
    'lidermatriz1': { name: 'Líder Matriz 1', pass: 'lider1', role: 'LIDER', panel: 'producao' },
    'lidermatriz 1': { name: 'Líder Matriz 1', pass: 'lider1', role: 'LIDER', panel: 'producao' },
    'lidermatriz2': { name: 'Líder Matriz 2', pass: 'lider2', role: 'LIDER', panel: 'producao' },
    'lidermatriz 2': { name: 'Líder Matriz 2', pass: 'lider2', role: 'LIDER', panel: 'producao' },
    'lidermatriz3': { name: 'Líder Matriz 3', pass: 'lider3', role: 'LIDER', panel: 'producao' },
    'lidermatriz 3': { name: 'Líder Matriz 3', pass: 'lider3', role: 'LIDER', panel: 'producao' },
    'lidermatriz4': { name: 'Líder Matriz 4', pass: 'lider4', role: 'LIDER', panel: 'producao' },
    'lidermatriz 4': { name: 'Líder Matriz 4', pass: 'lider4', role: 'LIDER', panel: 'producao' },
  };

  const handleSelectPanel = (panelKey: PanelKey) => {
    setSelectedPanel(panelKey);
    setSelectedPanelStore(panelKey);
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const noSpacesUsername = cleanUsername.replace(/\s+/g, '');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: noSpacesUsername, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        login({
          ...data,
          panel: selectedPanel || undefined,
        });

        setLoading(false);
        // Redirecionamento estrito baseado no painel escolhido
        if (selectedPanel === 'manutencao' || data.role?.toLowerCase() === 'mechanic') {
          navigate('/manutencao', { replace: true });
        } else {
          navigate('/producao', { replace: true });
        }
        return;
      }

      throw new Error('Fallback to mock');
    } catch {
      // Mock / Offline fallback
      const user = mockUsers[cleanUsername] || mockUsers[noSpacesUsername];
      if (user && user.pass === password) {
        login({
          id: noSpacesUsername,
          name: user.name,
          email: noSpacesUsername,
          role: user.role,
          token: 'mock-jwt-token',
          panel: selectedPanel || user.panel,
        });

        setLoading(false);
        if (selectedPanel === 'manutencao' || user.role === 'mechanic') {
          navigate('/manutencao', { replace: true });
        } else {
          navigate('/producao', { replace: true });
        }
      } else {
        setError('Credenciais inválidas. Verifique o login e a senha digitados.');
        setLoading(false);
      }
    }
  };

  const activePanelConfig = PANELS.find((p) => p.key === selectedPanel);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-orange-500 selection:text-white">
      {/* Background industrial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.12),rgba(255,255,255,0))]" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Company Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 text-center">
          <div className="mb-3 bg-white p-3 rounded-2xl shadow-xl shadow-black/60 border border-neutral-800">
            <VivaLogo className="h-10 sm:h-12 w-auto" variant="dark" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-100">
            Viva Cerâmica • Sistema Fabril Integrado
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Plataforma Operacional de Qualidade, Manutenção e Processos
          </p>
        </div>

        {/* ETAPA A: SELEÇÃO PRÉVIA DO MÓDULO / PAINEL */}
        {!selectedPanel && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
            <div className="text-center space-y-1 pb-2 border-b border-neutral-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                Etapa 1 de 2 • Seleção do Setor
              </span>
              <h2 className="text-lg sm:text-xl font-black text-neutral-100 mt-2">
                Escolha o Painel que Deseja Acessar
              </h2>
              <p className="text-xs text-neutral-400">
                Selecione o setor operacional para carregar a autenticação apropriada
              </p>
            </div>

            {/* 4 Interactive High-Contrast Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PANELS.map((panel) => {
                const Icon = panel.icon;
                return (
                  <button
                    key={panel.key}
                    type="button"
                    onClick={() => handleSelectPanel(panel.key)}
                    className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${panel.cardBg} ${panel.cardBorder} hover:scale-[1.015] active:scale-[0.985] cursor-pointer shadow-lg flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                          <Icon size={20} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {panel.badge}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-neutral-100 group-hover:text-orange-400 transition-colors">
                        {panel.title}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                        {panel.subtitle}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs font-bold text-orange-400 group-hover:translate-x-1 transition-transform">
                      <span>Acessar Painel</span>
                      <span>➔</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-center pt-2">
              <p className="text-[11px] text-neutral-500">
                🔒 Acesso restrito a colaboradores autorizados da Viva Cerâmica
              </p>
            </div>
          </div>
        )}

        {/* ETAPA B: FORMULÁRIO DE AUTENTICAÇÃO ADAPTÁVEL */}
        {selectedPanel && activePanelConfig && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
            {/* Header com botão de voltar para Etapa A */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <button
                type="button"
                onClick={() => setSelectedPanel(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors active:scale-95"
              >
                <ArrowLeft size={14} />
                <span>Trocar de Painel</span>
              </button>

              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                Etapa 2 • Autenticação
              </span>
            </div>

            {/* Cabeçalho Adaptável */}
            <div className="flex items-start gap-3 bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                <activePanelConfig.icon size={24} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-neutral-100">
                  {selectedPanel === 'manutencao'
                    ? 'Acesso ao Painel da Manutenção'
                    : selectedPanel === 'producao'
                    ? 'Acesso ao Controle de Produção'
                    : selectedPanel === 'forno'
                    ? 'Acesso ao Setor do Forno'
                    : 'Acesso à Retífica de Piso'}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {selectedPanel === 'manutencao'
                    ? 'Informe suas credenciais de mecânico para gerenciar trocas e prazos de peças.'
                    : 'Insira seu usuário e senha de líder ou inspetor de qualidade.'}
                </p>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wide mb-1.5">
                  Login / Usuário
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl py-3 px-4 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wide mb-1.5">
                  Senha de Acesso
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl py-3 px-4 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                  required
                />
              </div>

              {/* Botão Entrar no Painel */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-orange-500 hover:bg-orange-600 text-neutral-950 font-black text-sm sm:text-base rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all active:scale-[0.985] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Validando Acesso...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={18} />
                    <span>
                      Entrar no Painel {selectedPanel === 'manutencao' ? 'da Manutenção' : 'de Produção'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

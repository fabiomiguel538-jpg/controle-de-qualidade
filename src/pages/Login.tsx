import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Loader2 } from 'lucide-react';
import VivaLogo from '../components/VivaLogo';

export default function Login() {
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const mockUsers: Record<string, any> = {
      'admin': { name: 'Administrador', pass: '741741', role: 'ADMIN' },
      'lidermatriz1': { name: 'Líder Matriz 1', pass: 'lider1', role: 'LIDER' },
      'lidermatriz 1': { name: 'Líder Matriz 1', pass: 'lider1', role: 'LIDER' },
      'lidermatriz2': { name: 'Líder Matriz 2', pass: 'lider2', role: 'LIDER' },
      'lidermatriz 2': { name: 'Líder Matriz 2', pass: 'lider2', role: 'LIDER' },
      'lidermatriz3': { name: 'Líder Matriz 3', pass: 'lider3', role: 'LIDER' },
      'lidermatriz 3': { name: 'Líder Matriz 3', pass: 'lider3', role: 'LIDER' },
      'lidermatriz4': { name: 'Líder Matriz 4', pass: 'lider4', role: 'LIDER' },
      'lidermatriz 4': { name: 'Líder Matriz 4', pass: 'lider4', role: 'LIDER' }
    };

    const cleanUsername = username.trim().toLowerCase();
    const noSpacesUsername = cleanUsername.replace(/\s+/g, '');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: noSpacesUsername, password })
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        login(data);
        setLoading(false);
        return;
      }
      
      // se der erro (ex: 401, 503 ou retorno HTML da Netlify), forçamos o catch para tentar o mock fallback
      throw new Error('Fallback to mock');
    } catch (e) {
      // Mock fallback if backend is unavailable, not configured, or if DB doesn't have the user yet
      const user = mockUsers[cleanUsername] || mockUsers[noSpacesUsername];
      if (user && user.pass === password) {
        login({
          id: noSpacesUsername,
          name: user.name,
          email: noSpacesUsername,
          role: user.role,
          token: 'mock-jwt-token'
        });
      } else {
        setError('Credenciais inválidas. Verifique usuário e senha.');
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-neutral-900">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 w-full flex items-center justify-center">
            <VivaLogo className="h-16 w-auto" variant="dark" />
          </div>
          <h1 className="text-2xl font-bold text-center text-neutral-800">
            Controle de Defeitos Visuais
          </h1>
          <p className="text-neutral-500">Cerâmica - Produção</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}
          
          <div>
            <label className="block mb-2 text-sm font-medium text-neutral-700">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-lg"
              placeholder="Digite seu usuário"
              required
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-neutral-700">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-lg"
              placeholder="Digite sua senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-4 font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors text-lg disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

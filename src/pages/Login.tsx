import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Factory } from 'lucide-react';

export default function Login() {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@ceramica.com' || email === 'lider@ceramica.com') {
      login({
        id: '1',
        name: email === 'admin@ceramica.com' ? 'Administrador' : 'Líder Turno A',
        email,
        role: email === 'admin@ceramica.com' ? 'ADMIN' : 'LIDER',
        token: 'mock-jwt-token'
      });
    } else {
      setError('Credenciais inválidas. Tente admin@ceramica.com ou lider@ceramica.com');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-neutral-900">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 mb-4 bg-blue-100 rounded-full text-blue-600">
            <Factory size={48} />
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
            <label className="block mb-2 text-sm font-medium text-neutral-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
              placeholder="Digite seu email"
              required
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-neutral-700">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
              placeholder="Digite sua senha"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors text-lg"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

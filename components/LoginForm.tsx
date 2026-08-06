import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import logoImage from '../assets/mbr logo nova preta.jpeg';
import { authService } from '../services/authService';
import { AuthSession } from '../types';

interface LoginFormProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      const result = authService.login(email, password);
      setIsLoading(false);

      if (result.success && result.session) {
        onLoginSuccess(result.session);
      } else {
        setErrorMsg(result.message || 'Falha na autenticação. Verifique os dados fornecidos.');
      }
    }, 400); // Pequeno atraso simulado para feedback suave
  };


  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Decor Elements */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#F26522]/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-black rounded-3xl border border-slate-800 shadow-2xl mb-4 overflow-hidden inline-flex items-center justify-center w-36 h-36">
            <img src={logoImage} alt="MBR Tracker" className="w-full h-full object-contain p-2" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F26522]/10 border border-[#F26522]/30 text-[#F26522] text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" /> Portal de Acesso Restrito
          </span>
        </div>

        {/* Card do Formulário */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              Entrar na Conta
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Informe suas credenciais para acessar seu ambiente exclusivo.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3.5 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-xs font-bold text-rose-200 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-base shrink-0">⚠️</span>
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo E-mail */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                E-mail Corporativo ou Pessoal
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] transition-all font-medium"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Submissão */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-[#F26522] hover:bg-[#D94100] active:scale-[0.99] text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-950/30 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <span>Acessar Plataforma</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[11px] font-bold text-slate-500">
            © 2026 MBR Tracker — Todos os direitos reservados.
          </p>
        </div>

      </div>
    </div>
  );
};

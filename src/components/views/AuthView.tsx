import React, { useState } from 'react';
import { User, Lock, Mail, Sparkles, LogOut, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { authApi } from '../../services/authApi';
import { AuthUser } from '../../types';

interface AuthViewProps {
  currentUser: AuthUser | null;
  onAuthSuccess: (user: AuthUser) => void;
  onLogout: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  currentUser,
  onAuthSuccess,
  onLogout,
}) => {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (isSignup) {
        const res = await authApi.signup({ name, username, email, password });
        onAuthSuccess(res.user);
      } else {
        const res = await authApi.login(email || username, password);
        onAuthSuccess(res.user);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (currentUser) {
    return (
      <div className="max-w-xl mx-auto py-10 space-y-6 animate-in fade-in">
        <div className="bg-[#131722] border border-[#1F273A] rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-24 h-24 rounded-full mx-auto border-4 border-[#6366F1] shadow-xl object-cover" />
          
          <div>
            <h2 className="text-2xl font-black text-white font-display">{currentUser.name}</h2>
            <p className="text-xs text-[#6366F1] font-bold">@{currentUser.username}</p>
          </div>

          <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">{currentUser.bio}</p>

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#1F273A] max-w-xs mx-auto">
            <div>
              <div className="text-lg font-bold text-white">{currentUser.followersCount}</div>
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Followers</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{currentUser.followingCount}</div>
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Following</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#F87171] font-bold text-xs border border-[#F43F5E]/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10 animate-in zoom-in-95">
      <div className="bg-[#131722] border border-[#1F273A] rounded-3xl p-8 shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white mx-auto shadow-lg shadow-[#6366F1]/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white font-display">
            {isSignup ? 'Create Kinetic Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-[#94A3B8]">
            {isSignup ? 'Join the next-gen social music & short-video network' : 'Sign in to access your library, playlists and uploads'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#F43F5E]/15 border border-[#F43F5E]/40 rounded-xl text-xs text-[#F87171] text-center font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <>
              <div>
                <label className="text-xs font-bold text-[#94A3B8] block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Vance"
                  className="w-full bg-[#0D1017] border border-[#1F273A] rounded-xl p-3 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#6366F1]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#94A3B8] block mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alex_beats"
                  className="w-full bg-[#0D1017] border border-[#1F273A] rounded-xl p-3 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#6366F1]"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-bold text-[#94A3B8] block mb-1">Email or Username</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@kinetic.com"
              className="w-full bg-[#0D1017] border border-[#1F273A] rounded-xl p-3 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#6366F1]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#94A3B8] block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0D1017] border border-[#1F273A] rounded-xl p-3 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#6366F1]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-[#6366F1]/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isSignup ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              <>
                <span>{isSignup ? 'Sign Up' : 'Log In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-xs font-semibold text-[#6366F1] hover:underline"
          >
            {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </button>
        </div>

      </div>
    </div>
  );
};

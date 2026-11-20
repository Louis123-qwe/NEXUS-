import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useWorkspace } from '../../context/WorkspaceContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, requestPasswordReset } =
    useWorkspace();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onClose();
      } else if (mode === 'register') {
        if (!name.trim()) {
          setErrorMsg('Display name is required.');
          return;
        }
        await registerWithEmail(name.trim(), email, password);
        onClose();
      } else {
        await requestPasswordReset(email);
        setMode('login');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === 'login'
          ? 'Sign In to NEXUS'
          : mode === 'register'
            ? 'Create Operator Account'
            : 'Reset Password'
      }
      subtitle="Connect Firebase Authentication for real-time Cloud Firestore synchronization"
      maxWidth="sm"
    >
      <div className="space-y-5">
        <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-[#232838] text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
          <span>
            Google Sign-In is pre-configured for this workspace. Email/Password login and reset
            require enabling the Email/Password provider in your Firebase Console.
          </span>
        </div>

        <button
          type="button"
          onClick={async () => {
            await loginWithGoogle();
            onClose();
          }}
          className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          Continue with Google
        </button>

        <div className="relative flex items-center justify-center">
          <span className="h-px w-full bg-slate-200 dark:bg-[#232838]" />
          <span className="px-3 text-xs text-slate-400 bg-white dark:bg-[#131620] shrink-0">
            or use email
          </span>
          <span className="h-px w-full bg-slate-200 dark:bg-[#232838]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@company.com"
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 rounded-lg border border-slate-200 dark:border-[#232838] text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
          >
            {submitting
              ? 'Processing...'
              : mode === 'login'
                ? 'Sign In with Email'
                : mode === 'register'
                  ? 'Register Account'
                  : 'Send Reset Link'}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
          {mode !== 'login' ? (
            <button type="button" onClick={() => setMode('login')} className="hover:text-violet-500">
              Back to Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('register')}
              className="hover:text-violet-500"
            >
              Create account
            </button>
          )}
          {mode === 'login' && (
            <button type="button" onClick={() => setMode('reset')} className="hover:text-violet-500">
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

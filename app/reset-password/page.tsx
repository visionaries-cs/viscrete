'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

const inputCls = `w-full px-4 py-3 rounded-xl text-sm
  border border-gray-200 dark:border-gray-700
  bg-white dark:bg-[#1a1a1a]
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-[#2ca75d]
  focus:border-transparent transition`;

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  // Supabase exchanges the token from the URL hash automatically on load.
  // Wait for the PASSWORD_RECOVERY session event before showing the form.
  useEffect(() => {
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    const { error: authError } = await getSupabase().auth.updateUser({ password });
    setIsLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* Navbar */}
      <AppNav back="/login" guest />

      {/* Body */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#14171e] px-4 py-10">
        <div className="w-full max-w-sm">

          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#2ca75d] mx-auto" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Password updated</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Redirecting you to sign in…
              </p>
            </div>
          ) : !ready ? (
            <div className="text-center space-y-3">
              <svg className="w-8 h-8 animate-spin text-[#2ca75d] mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">Verifying reset link…</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">
                If nothing happens,{' '}
                <Link href="/forgot-password" className="text-[#2ca75d] hover:underline">
                  request a new link
                </Link>.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Set new password
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                Choose a strong password for your account.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={cn(inputCls, 'pr-11')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide' : 'Show'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className={cn(inputCls, 'pr-11')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide' : 'Show'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <ErrorAlert variant="inline" error={error} title="Couldn't update your password" />

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2 border',
                    isLoading
                      ? 'bg-green-700 text-white border-green-700 cursor-not-allowed opacity-50'
                      : 'bg-green-700 hover:bg-green-800 text-white border-green-700 active:scale-[0.98] cursor-pointer',
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Updating…
                    </span>
                  ) : 'Update password'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

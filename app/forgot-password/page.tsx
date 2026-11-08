'use client';

import { useState, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import AppNav from '@/components/AppNav';

const inputCls = `w-full px-4 py-3 rounded-xl text-sm
  border border-gray-200 dark:border-gray-700
  bg-white dark:bg-[#1a1a1a]
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-[#2ca75d]
  focus:border-transparent transition`;

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  );
}

function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error: authError } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#14171e]">
      <AppNav back="/login" guest />
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Reset password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Check your inbox — a reset link has been sent to <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputCls}
            />

            <ErrorAlert variant="inline" error={error} title="Couldn't send the reset email" />

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-semibold transition border',
                isLoading
                  ? 'bg-green-700 text-white border-green-700 cursor-not-allowed opacity-50'
                  : 'bg-green-700 hover:bg-green-800 text-white border-green-700 active:scale-[0.98] cursor-pointer',
              )}
            >
              {isLoading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}

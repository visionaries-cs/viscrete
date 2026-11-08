'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { getSupabase } from '@/lib/supabase';

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  );
}

type State = 'verifying' | 'success' | 'error';

function ConfirmContent() {
  const router = useRouter();
  const [state, setState] = useState<State>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Supabase exchanges the token in the URL hash automatically.
    // Listening for SIGNED_IN after a confirmation link means the email was verified.
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setState('success');
          setTimeout(() => router.push('/inspection'), 2500);
        } else if (event === 'TOKEN_REFRESHED') {
          // already confirmed before — just redirect
          setState('success');
          setTimeout(() => router.push('/inspection'), 2500);
        }
      }
    );

    // Fallback: if session already exists (re-visit), redirect immediately
    getSupabase().auth.getSession().then(({ data, error }) => {
      if (error) {
        setState('error');
        setErrorMsg(error.message);
      } else if (data.session) {
        setState('success');
        setTimeout(() => router.push('/inspection'), 2500);
      } else {
        // No session and no event fired after a short wait → bad/expired link
        const timeout = setTimeout(() => {
          setState(prev => prev === 'verifying' ? 'error' : prev);
          setErrorMsg('The confirmation link is invalid or has expired.');
        }, 5000);
        return () => clearTimeout(timeout);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#14171e]">

      {/* Navbar */}
      <AppNav back="/login" guest />

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {state === 'verifying' && (
            <div className="text-center space-y-5">
              {/* Animated icon */}
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-[#2ca75d]/10 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-[#2ca75d]/10 flex items-center justify-center">
                  <Mail className="w-7 h-7 text-[#2ca75d]" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Confirming your email
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Please wait while we verify your account…
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Verifying
              </div>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center space-y-5">
              {/* Success icon */}
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30
                              flex items-center justify-center ring-8 ring-emerald-50 dark:ring-emerald-950/20">
                <CheckCircle2 className="w-8 h-8 text-[#2ca75d]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Email confirmed!
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your account is verified. Redirecting you to the app…
                </p>
              </div>
              {/* Progress bar */}
              <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#2ca75d] rounded-full animate-[grow_2.5s_linear_forwards]"
                     style={{ width: '0%', animation: 'none' }}>
                  <div className="h-full bg-[#2ca75d] rounded-full"
                       style={{ animation: 'growWidth 2.5s linear forwards' }} />
                </div>
              </div>
              <style>{`
                @keyframes growWidth {
                  from { width: 0% }
                  to   { width: 100% }
                }
              `}</style>
              <Link
                href="/inspection"
                className="inline-block text-xs text-[#2ca75d] hover:underline"
              >
                Go now →
              </Link>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-5">
              {/* Error icon */}
              <div className="mx-auto w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30
                              flex items-center justify-center ring-8 ring-red-50 dark:ring-red-950/20">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Confirmation failed
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {errorMsg || 'The confirmation link is invalid or has expired.'}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="w-full py-3 rounded-xl text-sm font-semibold text-center transition border
                             bg-green-700 hover:bg-green-800 text-white border-green-700
                             active:scale-[0.98]"
                >
                  Back to sign in
                </Link>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Need a new link?{' '}
                  <Link href="/login" className="text-[#2ca75d] hover:underline">
                    Sign up again
                  </Link>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

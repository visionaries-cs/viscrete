'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';

const inputCls = `w-full px-4 py-3 rounded-xl text-sm
  border border-gray-200 dark:border-gray-700
  bg-white dark:bg-[#1a1a1a]
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-[#2ca75d]
  focus:border-transparent transition`;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectedFrom') ?? '/upload';
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sign-up fields
  const [name, setName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [showSuPassword, setShowSuPassword] = useState(false);
  const [showSuConfirm, setShowSuConfirm] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleModeSwitch = (next: 'login' | 'signup') => {
    setError('');
    setMode(next);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error: authError } = await getSupabase().auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    } else {
      router.push(redirectTo);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (suPassword !== suConfirm) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    const { error: authError } = await getSupabase().auth.signUp({
      email: suEmail,
      password: suPassword,
      options: { data: { inspector_name: name } },
    });
    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    } else {
      setError('');
      setMode('login');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── NAVBAR — spans full width above both columns ─────── */}
      <header className="shrink-0 z-10
                         border-b border-emerald-100 dark:border-[#2ca75d]/10
                         bg-white/80 dark:bg-[#14171e]/80 backdrop-blur-md">
        <div className="max-w-none px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 select-none">
            <span className="text-sm font-bold font-mono tracking-tight
                             bg-gradient-to-r from-[#2ca75d] to-[#0da6f2]
                             bg-clip-text text-transparent">
              viscrete
            </span>
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-mono">
              / concrete inspection
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/instructions"
                  className="text-xs font-medium text-gray-500 dark:text-gray-400
                             hover:text-gray-900 dark:hover:text-white transition-colors">
              How to Use
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* ── TWO-COLUMN BODY ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

      {/* ── LEFT PANEL — brand (desktop only) ────────────────── */}
      <div className="hidden lg:flex lg:w-[44%] relative flex-col overflow-hidden
                      bg-white dark:bg-[#14171e]
                      border-r border-gray-200 dark:border-gray-800">

        {/* Grid background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 dark:hidden
            bg-[linear-gradient(to_right,#2ca75d0d_1px,transparent_1px),linear-gradient(to_bottom,#2ca75d0d_1px,transparent_1px)]
            bg-[size:14px_24px]
            [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,#000_60%,transparent_110%)]" />
          <div className="absolute inset-0 hidden dark:block
            bg-[linear-gradient(to_right,#2ca75d15_1px,transparent_1px),linear-gradient(to_bottom,#2ca75d15_1px,transparent_1px)]
            bg-[size:14px_24px]
            [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,#000_60%,transparent_110%)]" />
        </div>

        {/* Scan line — sweeps over building and grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-x-0 h-px bg-[#2ca75d]/10 dark:bg-[#2ca75d]/20 animate-scan-line" />
        </div>

        {/* Panel content */}
        <div className="relative z-10 flex flex-col h-full px-10 pt-10 pb-10">

          {/* Center: hero block — pushed to vertical center with flex-1 spacers */}
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* Badge — matches HeroSection exactly */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                            border border-emerald-300 bg-emerald-50
                            dark:border-[#2ca75d]/30 dark:bg-[#1e4032]">
              <span className="w-2 h-2 rounded-full bg-[#2ca75d] animate-pulse" />
              <span className="text-xs font-mono text-emerald-700 dark:text-[#2ca75d]">
                Structural Analysis Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-7xl font-bold tracking-tight
                           bg-gradient-to-r from-[#2ca75d] to-[#0da6f2]
                           bg-clip-text text-transparent">
              viscrete
            </h1>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-[260px]">
              Visual Inspection System for Concrete Evaluation — automated defect detection for safer infrastructure.
            </p>

            {/* Defect type pills — hover to see description */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Cracks',   dot: 'bg-red-500',    bubble: 'bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-200',    arrow: 'border-b-red-500/40',    tip: 'Fractures in concrete caused by structural stress or shrinkage.' },
                { label: 'Spalling', dot: 'bg-yellow-500', bubble: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-800 dark:text-yellow-200', arrow: 'border-b-yellow-500/40', tip: 'Surface layers breaking off due to corrosion or freeze-thaw cycles.' },
                { label: 'Peeling',  dot: 'bg-orange-500', bubble: 'bg-orange-500/10 border-orange-500/25 text-orange-800 dark:text-orange-200', arrow: 'border-b-orange-500/40', tip: 'Detachment of surface coatings from the concrete substrate.' },
                { label: 'Algae',    dot: 'bg-green-500',  bubble: 'bg-green-500/10 border-green-500/25 text-green-800 dark:text-green-200',   arrow: 'border-b-green-500/40',  tip: 'Biological growth on moist concrete surfaces indicating water ingress.' },
              ].map(({ label, dot, bubble, arrow, tip }) => (
                <div key={label} className="relative group">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full
                                  border border-gray-200 dark:border-gray-700/50
                                  bg-white/60 dark:bg-gray-800/20
                                  backdrop-blur-sm cursor-default transition-colors
                                  group-hover:border-gray-300 dark:group-hover:border-gray-600">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{label}</span>
                  </div>
                  {/* Tooltip — below pill, left-anchored to stay within panel */}
                  <div className={cn(
                    'absolute top-full left-0 mt-2 z-20',
                    'w-44 px-3 py-2 rounded-lg text-xs leading-snug',
                    'border backdrop-blur-sm shadow-sm pointer-events-none',
                    'opacity-0 translate-y-1',
                    'group-hover:opacity-100 group-hover:translate-y-0',
                    'transition-all duration-150',
                    bubble
                  )}>
                    {/* Arrow pointing up */}
                    <span className={cn(
                      'absolute bottom-full left-4',
                      'border-4 border-transparent',
                      arrow
                    )} />
                    {tip}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: tech stack tag — sits flush at bottom */}
          <p className="text-xs font-mono text-gray-400 dark:text-gray-600">
            / YOLOv11 · CLAHE · MOCS
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-[#0a0a0a]">

        {/* Form area — vertically centered */}
        <div className="flex-1 flex items-center justify-center px-8 py-10">
          <div className="w-full max-w-[380px]">

            {/* Mode toggle — segmented control */}
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-700
                            bg-gray-100 dark:bg-gray-800/50 p-1 mb-8">
              {(['login', 'signup'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeSwitch(m)}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
                    mode === m
                      ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Sliding form container */}
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ width: '200%', transform: mode === 'login' ? 'translateX(0)' : 'translateX(-50%)' }}
              >

                {/* ── LOGIN panel ── */}
                <div style={{ width: '50%' }}
                     className={cn('min-w-0 transition-opacity duration-300',
                       mode === 'login' ? 'opacity-100' : 'opacity-0')}>
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1.5">
                      Welcome back
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sign in to your registered account
                    </p>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                      <input id="email" type="email" required autoComplete="email"
                             value={email} onChange={e => setEmail(e.target.value)}
                             placeholder="sample@example.com" className={inputCls} />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                      <div className="relative">
                        <input id="password" type={showPassword ? 'text' : 'password'} required
                               autoComplete="current-password" value={password}
                               onChange={e => setPassword(e.target.value)}
                               placeholder="••••••••" className={cn(inputCls, 'pr-11')} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide' : 'Show'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && mode === 'login' && (
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">{error}</div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none group">
                        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="sr-only" />
                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                          rememberMe ? 'bg-[#2ca75d] border-[#2ca75d]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a] group-hover:border-[#2ca75d]/60')}>
                          {rememberMe && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                      </label>
                      <Link href="/forgot-password" className="text-sm text-[#2ca75d] hover:text-[#2ca75d]/80 transition-colors">
                        Forgot password?
                      </Link>
                    </div>

                    <div className="pt-2">
                      <button type="submit" disabled={isLoading}
                              className={cn('w-full py-3 rounded-xl text-sm font-semibold text-black transition-all',
                                isLoading ? 'bg-[#e5ac0c]/50 cursor-not-allowed' : 'bg-[#e5ac0c] hover:bg-[#d4a00b] active:scale-[0.99] cursor-pointer')}>
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Signing in…
                          </span>
                        ) : 'Sign in'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* ── SIGN UP panel ── */}
                <div style={{ width: '50%' }}
                     className={cn('min-w-0 transition-opacity duration-300',
                       mode === 'signup' ? 'opacity-100' : 'opacity-0')}>
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1.5">
                      Create account
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Register your account
                    </p>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full name</label>
                      <input id="name" type="text" required autoComplete="name"
                             value={name} onChange={e => setName(e.target.value)}
                             placeholder="Full Name" className={inputCls} />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="su-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                      <input id="su-email" type="email" required autoComplete="email"
                             value={suEmail} onChange={e => setSuEmail(e.target.value)}
                             placeholder="sample@example.com" className={inputCls} />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="su-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                      <div className="relative">
                        <input id="su-password" type={showSuPassword ? 'text' : 'password'} required
                               autoComplete="new-password" value={suPassword}
                               onChange={e => setSuPassword(e.target.value)}
                               placeholder="••••••••" className={cn(inputCls, 'pr-11')} />
                        <button type="button" onClick={() => setShowSuPassword(!showSuPassword)}
                                aria-label={showSuPassword ? 'Hide' : 'Show'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                          {showSuPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="su-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password</label>
                      <div className="relative">
                        <input id="su-confirm" type={showSuConfirm ? 'text' : 'password'} required
                               autoComplete="new-password" value={suConfirm}
                               onChange={e => setSuConfirm(e.target.value)}
                               placeholder="••••••••" className={cn(inputCls, 'pr-11')} />
                        <button type="button" onClick={() => setShowSuConfirm(!showSuConfirm)}
                                aria-label={showSuConfirm ? 'Hide' : 'Show'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                          {showSuConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && mode === 'signup' && (
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">{error}</div>
                    )}

                    <div className="pt-2">
                      <button type="submit" disabled={isLoading}
                              className={cn('w-full py-3 rounded-xl text-sm font-semibold text-black transition-all',
                                isLoading ? 'bg-[#e5ac0c]/50 cursor-not-allowed' : 'bg-[#e5ac0c] hover:bg-[#d4a00b] active:scale-[0.99] cursor-pointer')}>
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Creating account…
                          </span>
                        ) : 'Create account'}
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      </div>{/* end two-column body */}
    </div>
  );
}

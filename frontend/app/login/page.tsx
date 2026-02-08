'use client';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  // Hardcoded credentials
  const VALID_EMAIL = 'admin@viscrete.com';
  const VALID_PASSWORD = 'admin123';

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate credentials
    if (email === VALID_EMAIL && password === VALID_PASSWORD) {
      console.log('Sign in successful:', { email, rememberMe });

      // Add a short delay before redirecting
      setTimeout(() => {
        router.push('/upload-image');
      }, 600);
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-xl">
        {/* Return Button */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 bg-black dark:bg-white px-4 py-2 rounded-xl text-white dark:text-black hover:opacity-80 transition-all transform hover:scale-105">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Return</span>
          </Link>
        </div>

        {/* Login Form Card */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-xl p-10 space-y-8 backdrop-blur-sm">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">Welcome Back</h1>
          </div>

          <form onSubmit={handleSignIn} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-base font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-5 py-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-base font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-5 py-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border border-input bg-background accent-foreground"
                />
                <span className="text-sm text-foreground">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="transform transition duration-500 hover:scale-105 w-full rounded-lg bg-primary px-5 py-4 text-base text-primary-foreground font-medium hover:bg-primary/90 cursor-pointer"
            >
              Sign in
            </button>

            {/* Sign up link */}
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
'use client';
import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';

export function useCurrentUser() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  return { email };
}

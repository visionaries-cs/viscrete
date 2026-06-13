'use client';
import { useState, useEffect } from 'react';
import { getJobStorageUrl, getFileUrl } from '@/lib/api';

/** Resolves a Supabase Storage object key to a 1-hour signed URL. */
export function useSignedUrl(jobId: string | null | undefined, storageKey: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!jobId || !storageKey) { setUrl(null); return; }
    let active = true;
    getJobStorageUrl(jobId, storageKey)
      .then(u => { if (active) setUrl(u); })
      .catch(() => {});
    return () => { active = false; };
  }, [jobId, storageKey]);

  return url;
}

/** Resolves a file_id to a signed URL (ownership verified via the parent job). */
export function useFileUrl(fileId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!fileId) { setUrl(null); return; }
    let active = true;
    getFileUrl(fileId)
      .then(u => { if (active) setUrl(u); })
      .catch(() => {});
    return () => { active = false; };
  }, [fileId]);

  return url;
}

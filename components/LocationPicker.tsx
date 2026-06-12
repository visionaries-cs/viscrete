'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), { ssr: false });

interface Props {
  value: string;
  onChange: (address: string) => void;
}

export default function LocationPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function handleConfirm(address: string) {
    onChange(address);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left
                   border border-gray-300 dark:border-gray-700
                   bg-white dark:bg-[#1a1a1a]
                   text-gray-900 dark:text-white
                   hover:border-blue-400 dark:hover:border-blue-500
                   focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      >
        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
        <span className={value ? 'truncate' : 'text-gray-400'}>
          {value || 'Select location on map…'}
        </span>
        {value && (
          <X
            className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 ml-auto"
            onClick={e => { e.stopPropagation(); onChange(''); }}
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-full p-6 bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Pick Inspection Location
            </DialogTitle>
            <DialogDescription className="sr-only">
              Search for an address or click the map to drop a pin, then confirm your selection.
            </DialogDescription>
          </DialogHeader>
          <LocationPickerMap onConfirm={handleConfirm} />
        </DialogContent>
      </Dialog>
    </>
  );
}

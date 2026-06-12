'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2 } from 'lucide-react';

// Fix Leaflet default marker icon broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LatLng { lat: number; lng: number; }

interface Props {
  initial?: LatLng;
  onConfirm: (address: string, lat: number, lng: number) => void;
}

function ClickHandler({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { 'Accept-Language': 'en' } },
  );
  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function searchAddress(query: string): Promise<{ display_name: string; lat: string; lon: string }[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
    { headers: { 'Accept-Language': 'en' } },
  );
  if (!res.ok) return [];
  return res.json();
}

export default function LocationPickerMap({ initial, onConfirm }: Props) {
  const defaultCenter: LatLng = initial ?? { lat: 14.5995, lng: 120.9842 }; // Manila
  const [pin, setPin]           = useState<LatLng | null>(initial ?? null);
  const [address, setAddress]   = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  async function handlePick(ll: LatLng) {
    setPin(ll);
    setResults([]);
    setGeocoding(true);
    const addr = await reverseGeocode(ll.lat, ll.lng);
    setAddress(addr);
    setGeocoding(false);
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const res = await searchAddress(query);
    setResults(res);
    setSearching(false);
  }

  function handleResultPick(r: { display_name: string; lat: string; lon: string }) {
    const ll = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    setPin(ll);
    setAddress(r.display_name);
    setResults([]);
    setQuery('');
    mapRef.current?.setView([ll.lat, ll.lng], 17);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700
                         bg-white dark:bg-[#1a1a1a] text-sm text-gray-900 dark:text-white
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search for a place or address…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-1.5 transition"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[9999] mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1e1e] shadow-lg overflow-hidden">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleResultPick(r)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200
                           hover:bg-blue-50 dark:hover:bg-blue-950/40 border-b border-gray-100
                           dark:border-gray-800 last:border-0 transition"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 380 }}>
        <MapContainer
          center={[defaultCenter.lat, defaultCenter.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          {/* ESRI World Imagery — satellite */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles © Esri"
            maxZoom={19}
          />
          {/* ESRI Labels overlay */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            attribution=""
            maxZoom={19}
            opacity={0.8}
          />

          <ClickHandler onPick={handlePick} />
          {pin && <Marker position={[pin.lat, pin.lng]} />}
        </MapContainer>
      </div>

      {/* Address preview */}
      <div className="text-xs text-gray-500 dark:text-gray-400 min-h-[1.25rem]">
        {geocoding
          ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Getting address…</span>
          : pin
            ? <span><span className="font-medium text-gray-700 dark:text-gray-300">Selected: </span>{address}</span>
            : 'Click anywhere on the map to drop a pin'}
      </div>

      {/* Confirm */}
      <button
        disabled={!pin}
        onClick={() => pin && onConfirm(address, pin.lat, pin.lng)}
        className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200
                   dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600
                   text-white font-semibold text-sm transition"
      >
        Confirm Location
      </button>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Plus, Search, Loader2, AlertCircle, MapPin, User, Calendar, ChevronRight, LogOut, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { getSupabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { listSites, createSite, deleteSite, type SiteResponse } from "@/lib/api";
import LocationPicker from "@/components/LocationPicker";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SiteCard({
  site,
  selected,
  onSelect,
  onDeleteRequest,
}: {
  site: SiteResponse;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  return (
    <div className={`group relative rounded-xl border transition-all bg-white dark:bg-[#161616] flex flex-col ${
      selected
        ? "border-blue-400 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-950/10"
        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
    }`}>
      {/* Top action row — checkbox left, trash right */}
      <div className="flex items-center justify-between px-3 pt-3 pb-0">
        {/* Checkbox */}
        <button
          onClick={() => onSelect(site.site_id)}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition cursor-pointer ${
            selected
              ? "border-blue-500 bg-blue-500"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
          }`}
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Trash — visible on hover or when selected */}
        <button
          onClick={() => onDeleteRequest(site.site_id)}
          className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition cursor-pointer"
          title="Delete site"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card body — navigates to site */}
      <Link href={`/sites/${site.site_id}`} className="flex flex-col gap-2 px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{site.name}</p>
            {site.address && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />{site.address}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {site.inspector_name || "—"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(site.created_at)}
          </span>
        </div>
      </Link>
    </div>
  );
}

export default function InspectionPage() {
  const router = useRouter();
  const { email } = useCurrentUser();

  // ── Site list
  const [sites, setSites] = useState<SiteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ── Create site form
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Select + delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  useEffect(() => {
    loadSites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSites() {
    setLoading(true);
    setError(null);
    try {
      const data = await listSites();
      setSites(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!siteName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const site = await createSite({
        name:           siteName.trim(),
        address:        address.trim(),
        inspector_name: inspectorName.trim(),
      });
      router.push(`/sites/${site.site_id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create site");
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!pendingDeleteIds.length) return;
    // Optimistic: snapshot → apply → fire → rollback on error
    const snapshot = sites.filter(s => pendingDeleteIds.includes(s.site_id));
    setSites(prev => prev.filter(s => !pendingDeleteIds.includes(s.site_id)));
    setSelectedIds(prev => { const n = new Set(prev); pendingDeleteIds.forEach(id => n.delete(id)); return n; });
    setPendingDeleteIds([]);
    setDeleteError(null);
    try {
      await Promise.all(snapshot.map(s => deleteSite(s.site_id)));
    } catch (e) {
      // Rollback
      setSites(prev => [...snapshot, ...prev]);
      setDeleteError(e instanceof Error ? e.message : "Failed to delete — items restored.");
    }
  }

  const filteredSites = sites.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase()) ||
    s.inspector_name.toLowerCase().includes(search.toLowerCase()),
  );

  const allSelected = filteredSites.length > 0 && selectedIds.size === filteredSites.length;

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === filteredSites.length ? new Set() : new Set(filteredSites.map(s => s.site_id)));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#14171e]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50
                         border-b border-emerald-100 dark:border-[#2ca75d]/10
                         bg-white/80 dark:bg-[#14171e]/80 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[180px]">
                {email}
              </span>
            )}
            <ModeToggle />
            <button
              onClick={async () => { await getSupabase().auth.signOut(); router.push('/login'); }}
              title="Sign out"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left — Create Site */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">New Inspection Site</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Group multiple inspection jobs under one building or project location.
                </p>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <Label htmlFor="siteName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Site Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="siteName"
                      placeholder="e.g. Rizal Hall Block A"
                      value={siteName}
                      onChange={e => setSiteName(e.target.value)}
                      required
                      className="border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Address
                    </Label>
                    <LocationPicker value={address} onChange={setAddress} />
                  </div>

                  <div>
                    <Label htmlFor="inspector" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Inspector / Structural Engineer
                    </Label>
                    <Input
                      id="inspector"
                      placeholder="Full name"
                      value={inspectorName}
                      onChange={e => setInspectorName(e.target.value)}
                      className="border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                    />
                  </div>

                  {createError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {createError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Button
                      type="submit"
                      disabled={creating || !siteName.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      {creating
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</>
                        : <><Plus className="w-4 h-4 mr-2" />Create Site</>
                      }
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right — Site List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-base font-bold text-gray-900 dark:text-white shrink-0">
                  Inspection Sites
                  {!loading && <span className="ml-2 text-sm font-normal text-gray-400">({filteredSites.length})</span>}
                </h2>
                {!loading && filteredSites.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer shrink-0"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => { setDeleteError(null); setPendingDeleteIds([...selectedIds]); }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete selected ({selectedIds.size})
                  </button>
                )}
              </div>
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search sites…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-44 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-sm"
                />
              </div>
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 p-3 mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {deleteError}
                <button onClick={() => setDeleteError(null)} className="ml-auto shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Loading sites…</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
                <button onClick={loadSites} className="ml-auto underline text-xs">Retry</button>
              </div>
            )}

            {!loading && !error && filteredSites.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Building2 className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">{search ? "No sites match your search" : "No inspection sites yet"}</p>
                <p className="text-xs mt-1">{search ? "" : "Create your first site to get started."}</p>
              </div>
            )}

            {!loading && !error && filteredSites.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSites.map(site => (
                  <SiteCard
                    key={site.site_id}
                    site={site}
                    selected={selectedIds.has(site.site_id)}
                    onSelect={toggleSelect}
                    onDeleteRequest={id => { setDeleteError(null); setPendingDeleteIds([id]); }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Delete confirmation modal ── */}
      {pendingDeleteIds.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { setPendingDeleteIds([]); setDeleteError(null); }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  {pendingDeleteIds.length === 1 ? "Delete Site" : `Delete ${pendingDeleteIds.length} Sites`}
                </h2>
              </div>
              <button
                onClick={() => { setPendingDeleteIds([]); setDeleteError(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              {pendingDeleteIds.length === 1 ? (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Delete site <span className="font-semibold text-gray-900 dark:text-white">{sites.find(s => s.site_id === pendingDeleteIds[0])?.name}</span>?
                </p>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Delete <span className="font-semibold text-gray-900 dark:text-white">{pendingDeleteIds.length} sites</span>?
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Site records will be removed. Existing jobs will not be affected.
              </p>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { setPendingDeleteIds([]); setDeleteError(null); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-500">© Viscrete 2026</p>
        </div>
      </footer>
    </div>
  );
}

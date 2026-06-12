"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Plus, Search, Loader2, AlertCircle, MapPin, User, Calendar, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { getSupabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { listSites, createSite, type SiteResponse } from "@/lib/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SiteCard({ site }: { site: SiteResponse }) {
  return (
    <Link href={`/sites/${site.site_id}`}>
      <div className="group cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] hover:border-blue-300 dark:hover:border-blue-700 transition-all p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition shrink-0 mt-1" />
        </div>

        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{site.name}</p>
          {site.address && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />{site.address}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {site.inspector_name || "—"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(site.created_at)}
          </span>
        </div>
      </div>
    </Link>
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

  const filteredSites = sites.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase()) ||
    s.inspector_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
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
                    <Label htmlFor="address" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Address
                    </Label>
                    <Input
                      id="address"
                      placeholder="e.g. 123 University Ave"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                    />
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Inspection Sites
                {!loading && <span className="ml-2 text-sm font-normal text-gray-400">({filteredSites.length})</span>}
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search sites…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-52 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-sm"
                />
              </div>
            </div>

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
                  <SiteCard key={site.site_id} site={site} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-500">© Viscrete 2026</p>
        </div>
      </footer>
    </div>
  );
}

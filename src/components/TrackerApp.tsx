import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';
import {
  COUNTRIES,
  COUNTRY_BY_CODE,
  SECTION_ORDER,
  SECTION_LABELS,
  getStickerSectionKey,
} from '../data/album-structure';
import StickerCard from './StickerCard';
import StickerDetailModal from './StickerDetailModal';
import FlagBlock from './FlagBlock';
import AlbumVersionPicker from './AlbumVersionPicker';
import type { AlbumVersion } from './AlbumVersionPicker';

type OwnedMap = Record<number, boolean>;

interface LoadedSticker {
  id: number;
  number: number;
  name: string;
  country: string;
  countryCode: string;
  pageNumber: number;
  positionInPage: number;
  sectionType: string;
  imageUrl?: string;
  ccVersion?: string;
  displayCode: string;
}

// CC sticker counts per version
const CC_COUNTS: Record<string, number> = { v1: 12, v2: 14, v3: 12, v4: 14 };

export default function TrackerApp() {
  const [stickers, setStickers] = useState<LoadedSticker[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(true);
  const [owned, setOwned] = useState<OwnedMap>({});
  const [loadingCollection, setLoadingCollection] = useState(true);
  const [albumVersion, setAlbumVersion] = useState<AlbumVersion | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [detailNumber, setDetailNumber] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load sticker catalog from DB
  useEffect(() => {
    async function loadStickers() {
      const [res1, res2] = await Promise.all([
        supabase.from('stickers').select('*').order('number', { ascending: true }).range(0, 999),
        supabase.from('stickers').select('*').order('number', { ascending: true }).range(1000, 1999),
      ]);
      const data = [...(res1.data ?? []), ...(res2.data ?? [])];
      const counters: Record<string, number> = {};
      const loaded = (data ?? []).map((row: any) => {
        const countryCode: string = row.country_code;
        counters[countryCode] = (counters[countryCode] || 0) + 1;
        const idx = counters[countryCode];
        let displayCode: string;
        if (countryCode === 'WP') displayCode = '00';
        else if (countryCode === 'CC') displayCode = `CC-${row.position_in_page}`;
        else displayCode = `${countryCode}-${idx}`;

        const normalizedSectionType = String(row.section_type ?? 'regular');

        // Extract ccVersion from country_code if it's a Coca-Cola variant (CCv1, CCv2, etc.)
        const ccVersionMatch = countryCode.match(/^CC(v\d+)$/);
        const ccVersion = ccVersionMatch ? ccVersionMatch[1] : undefined;

        return {
          id: row.id,
          number: row.number,
          name: row.name,
          country: row.country,
          countryCode,
          pageNumber: row.page_number,
          positionInPage: row.position_in_page,
          sectionType: row.section_type,
          imageUrl: row.image_url ?? undefined,
          ccVersion,
          displayCode,
        } as LoadedSticker;
      });
      setStickers(loaded);
      setLoadingStickers(false);
    }
    loadStickers();
  }, []);

  // Load user collection — direct Supabase call (browser-side, no server proxy)
  useEffect(() => {
    async function loadCollection() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth/login';
        return;
      }
      const { data, error } = await supabase
        .from('user_stickers')
        .select('sticker_id')
        .eq('user_id', session.user.id);
      if (error) {
        console.error('[TrackerApp] load error:', error.message);
      } else {
        const map: OwnedMap = {};
        for (const row of data ?? []) map[row.sticker_id] = true;
        setOwned(map);
      }
      setLoadingCollection(false);
    }
    loadCollection();
  }, []);

  // Load album version from user_profiles (runs in parallel with loadCollection)
  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoadingProfile(false); return; }
      const { data } = await supabase
        .from('user_profiles')
        .select('album_version')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setAlbumVersion((data?.album_version as AlbumVersion) ?? null);
      setLoadingProfile(false);
    }
    loadProfile();
  }, []);

  // Handle section from URL ?section=XXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) setCountryFilter(section);
  }, []);

  // `id` is the stickers table primary key — user_stickers.sticker_id references it,
  // not the album 'number' (which is not the same for Coca-Cola stickers).
  const handleToggle = useCallback(async (id: number, newOwned: boolean) => {
    if (toggling.has(id)) return;
    setToggling(prev => new Set(prev).add(id));
    setOwned(prev => ({ ...prev, [id]: newOwned }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (newOwned) {
        const { error } = await supabase
          .from('user_stickers')
          .upsert(
            { user_id: session.user.id, sticker_id: id, status: 'have' },
            { onConflict: 'user_id,sticker_id' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_stickers')
          .delete()
          .eq('user_id', session.user.id)
          .eq('sticker_id', id);
        if (error) throw error;
      }
    } catch (e: any) {
      console.error('[TrackerApp] save error:', e?.message ?? e);
      setOwned(prev => ({ ...prev, [id]: !newOwned }));
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [toggling]);

  // Section key lookup, derived from loaded stickers
  const STICKER_SECTIONS = useMemo(() => {
    const map: Record<number, string> = {};
    for (const s of stickers) map[s.number] = getStickerSectionKey(s.countryCode, s.number);
    return map;
  }, [stickers]);

  // ----- Stats -----
  const stats = useMemo(() => {
    const total = 980 + (albumVersion ? (CC_COUNTS[albumVersion] ?? 0) : 0);
    let ownedCount = 0, ownedSpecial = 0, totalSpecial = 0;
    const byCountry: Record<string, { total: number; owned: number }> = {};

    for (const s of stickers) {
      // Skip CC stickers that don't belong to this version
      if (s.ccVersion && s.ccVersion !== albumVersion) continue;
      const isSpecial = s.sectionType === 'special';
      if (isSpecial) totalSpecial++;
      const isOwned = !!owned[s.id];
      if (isOwned) {
        ownedCount++;
        if (isSpecial) ownedSpecial++;
      }
      const cc = s.countryCode;
      if (COUNTRY_BY_CODE[cc]) {
        if (!byCountry[cc]) byCountry[cc] = { total: 0, owned: 0 };
        byCountry[cc].total++;
        if (isOwned) byCountry[cc].owned++;
      }
    }

    const topMissing = Object.entries(byCountry)
      .map(([code, v]) => ({ code, missing: v.total - v.owned, total: v.total }))
      .sort((a, b) => b.missing - a.missing)
      .slice(0, 5);

    return {
      total, owned: ownedCount, missing: total - ownedCount,
      ownedSpecial, totalSpecial,
      pct: Math.round((ownedCount / total) * 100),
      topMissing,
    };
  }, [stickers, owned, albumVersion]);

  // ----- Filtered & Grouped -----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stickers.filter(s => {
      // Only show CC stickers matching the user's album version
      if (s.ccVersion) {
        if (!albumVersion || s.ccVersion !== albumVersion) return false;
      }
      if (filter === 'owned' && !owned[s.id]) return false;
      if (filter === 'missing' && owned[s.id]) return false;
      if (countryFilter !== 'all') {
        const sectionKey = STICKER_SECTIONS[s.number];
        if (sectionKey !== countryFilter) return false;
      }
      if (q) {
        const cc = COUNTRY_BY_CODE[s.countryCode];
        const hay = `${s.name} ${s.countryCode} ${s.country} ${cc?.name ?? ''} ${cc?.region ?? ''} coca-cola`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stickers, owned, filter, countryFilter, query, albumVersion]);

  const grouped = useMemo(() => {
    const map = new Map<string, LoadedSticker[]>();
    for (const s of filtered) {
      const key = STICKER_SECTIONS[s.number];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const ordered: Array<[string, LoadedSticker[]]> = [];
    for (const key of SECTION_ORDER) {
      if (map.has(key)) ordered.push([key, map.get(key)!]);
    }

    // When there's a text query, sort sections so that country code / name
    // matches float above sections that only match through player names.
    const q = query.trim().toLowerCase();
    if (q) {
      const sectionScore = (key: string): number => {
        const code = key.toLowerCase();
        const name = (COUNTRY_BY_CODE[key]?.name ?? '').toLowerCase();
        if (code === q || name === q)           return 0; // exact
        if (code.startsWith(q) || name.startsWith(q)) return 1; // prefix
        if (code.includes(q)  || name.includes(q))    return 2; // contains
        return 3;                                               // player-name only
      };
      ordered.sort((a, b) => sectionScore(a[0]) - sectionScore(b[0]));
    }

    return ordered;
  }, [filtered, query]);

  const handleReset = () => { setQuery(''); setFilter('all'); setCountryFilter('all'); };

  const detailSticker = detailNumber != null
    ? stickers.find(s => s.number === detailNumber) ?? null
    : null;

  if (loadingCollection || loadingProfile || loadingStickers) {
    return (
      <div className="loading-state mono">
        Loading your collection…
      </div>
    );
  }

  if (!albumVersion) {
    return <AlbumVersionPicker onSelect={setAlbumVersion} />;
  }

  return (
    <div className="tracker">
      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className="tracker__sidebar">
        {/* Progress */}
        <div className="sb-section">
          <p className="sb-eyebrow">Your progress</p>
          <div className="progress-headline">
            <span className="progress-headline__num">{stats.owned}</span>
            <span className="progress-headline__total">/ {stats.total}</span>
            <span className="progress-headline__pct" style={{ marginLeft: 'auto' }}>{stats.pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${stats.pct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            <span>{stats.owned} OWNED</span>
            <span>{stats.missing} TO GO</span>
          </div>
          <div className="stat-tiles" style={{ marginTop: 14 }}>
            <div className="stat-tile stat-tile--ok">
              <span className="stat-tile__val">{stats.owned}</span>
              <span className="stat-tile__lbl">Owned</span>
            </div>
            <div className="stat-tile stat-tile--miss">
              <span className="stat-tile__val">{stats.missing}</span>
              <span className="stat-tile__lbl">Missing</span>
            </div>
          </div>
        </div>

        {/* Specials */}
        <div className="sb-section">
          <p className="sb-eyebrow">Specials · {stats.ownedSpecial}/{stats.totalSpecial}</p>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 10px' }}>
            Tournament, host nations & cover stickers.
          </p>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${stats.totalSpecial > 0 ? Math.round((stats.ownedSpecial / stats.totalSpecial) * 100) : 0}%` }} />
          </div>
        </div>

        {/* Top missing */}
        <div className="sb-section">
          <p className="sb-eyebrow">Top missing teams</p>
          <div className="top-missing">
            {stats.topMissing.map(row => {
              const c = COUNTRY_BY_CODE[row.code];
              const pct = row.total ? ((row.total - row.missing) / row.total) * 100 : 0;
              return (
                <button
                  key={row.code}
                  className="top-missing__row"
                  onClick={() => setCountryFilter(row.code)}
                >
                  {c && <FlagBlock country={c} size="sm" />}
                  <span className="top-missing__code">{row.code}</span>
                  <span className="top-missing__bar">
                    <span style={{ width: `${pct}%`, background: c?.primary || 'var(--ink-2)' }} />
                  </span>
                  <span className="top-missing__num">−{row.missing}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Jump to */}
        <div className="sb-section">
          <p className="sb-eyebrow">Jump to</p>
          <select
            className="select"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
          >
            <option value="all">All sections</option>
            <option value="COVER">Cover</option>
            <option value="TRN">Tournament</option>
            <option value="HOST">Host Nations</option>
            <option value="CC">Coca-Cola</option>
            <optgroup label="Teams">
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </optgroup>
          </select>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────── */}
      <main className="tracker__main">
        {/* Section nav chips — auto-scrolling carousel, pauses on hover */}
        <nav className="section-nav" aria-label="Sections">
          <div className="section-nav__track">
            {[false, true].map((isDupe) => (
              <div
                key={isDupe ? 'dupe' : 'orig'}
                className="section-nav__set"
                aria-hidden={isDupe ? true : undefined}
              >
                {SECTION_ORDER.map(key => {
                  const items = stickers.filter(s => {
                    if (STICKER_SECTIONS[s.number] !== key) return false;
                    if (s.ccVersion && s.ccVersion !== albumVersion) return false;
                    return true;
                  });
                  if (!items.length) return null;
                  const ownedInSection = items.filter(s => owned[s.id]).length;
                  const isActive = countryFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setCountryFilter(key === countryFilter ? 'all' : key)}
                      className={[isActive ? 'is-active' : '', ownedInSection > 0 ? 'has-progress' : ''].filter(Boolean).join(' ')}
                      tabIndex={isDupe ? -1 : undefined}
                    >
                      <span className="dot" />
                      <span>{SECTION_LABELS[key] || key}</span>
                      <span style={{ opacity: 0.5 }}>{ownedInSection}/{items.length}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Filter bar */}
        <div className="filterbar">
          <div className="filterbar__strip">
            <span className="filterbar__strip-label">Live</span>
            <span className="filterbar__strip-stat">
              Showing <b>{filtered.length}</b> of <b>{stats.total}</b>
            </span>
            <span className="filterbar__strip-stat">
              Owned <b>{stats.owned}</b> · Missing <b>{stats.missing}</b>
            </span>
            <span className="filterbar__strip-spacer" />
            <span className="filterbar__strip-stat">
              {countryFilter === 'all'
                ? 'All sections'
                : (SECTION_LABELS[countryFilter] || countryFilter)} · {filter.toUpperCase()}
            </span>
          </div>

          <div className="filterbar__controls">
            <div className="filterbar__search">
              <svg className="filterbar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
              </svg>
              <input
                ref={searchRef}
                className="input"
                type="search"
                placeholder="Search player, team or section…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {!query && <span className="filterbar__search-kbd">⌘K</span>}
            </div>

            <select
              className="select filterbar__select"
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
            >
              <option value="all">All sections</option>
              <option value="COVER">Cover</option>
              <option value="TRN">Tournament</option>
              <option value="HOST">Host Nations</option>
              <option value="CC">Coca-Cola</option>
              <optgroup label="Teams">
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </optgroup>
            </select>

            <div className="segmented" role="tablist" aria-label="Filter">
              {(['all', 'owned', 'missing'] as const).map(k => (
                <button
                  key={k}
                  className={filter === k ? 'is-active' : ''}
                  onClick={() => setFilter(k)}
                  role="tab"
                  aria-selected={filter === k}
                >
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>

            {(query || filter !== 'all' || countryFilter !== 'all') && (
              <button className="btn btn--ghost" onClick={handleReset}>Reset</button>
            )}
          </div>
        </div>

        {/* Sticker sections */}
        {grouped.length === 0 && (
          <div className="empty">
            No stickers match your filters.{' '}
            <button className="btn btn--ghost" onClick={handleReset} style={{ display: 'inline-flex', padding: '4px 10px' }}>
              Reset
            </button>
          </div>
        )}

        {grouped.map(([sectionKey, items]) => {
          const ownedInSection = items.filter(s => owned[s.id]).length;
          const countryData = COUNTRY_BY_CODE[sectionKey];
          return (
            <section className="section" key={sectionKey} data-section={sectionKey}>
              <header className="section__head">
                <h2 className="section__title">
                  {countryData && <FlagBlock country={countryData} size="md" />}
                  {SECTION_LABELS[sectionKey] || sectionKey}
                </h2>
                <span className="section__code">{sectionKey}</span>
                <span className="section__progress">
                  <b>{ownedInSection}</b> / {items.length}
                </span>
              </header>
              <div className="sticker-grid">
                {items.map(s => (
                  <StickerCard
                    key={s.number}
                    id={s.id}
                    number={s.number}
                    name={s.name}
                    country={s.country}
                    countryCode={s.countryCode}
                    sectionType={s.sectionType}
                    owned={!!owned[s.id]}
                    displayCode={s.displayCode}
                    photoUrl={s.imageUrl ?? null}
                    onToggle={handleToggle}
                    onOpenDetail={setDetailNumber}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Detail modal */}
      {detailSticker && (
        <StickerDetailModal
          sticker={detailSticker}
          owned={!!owned[detailSticker.id]}
          onClose={() => setDetailNumber(null)}
          onToggle={handleToggle}
        />
      )}
    </div>
  );
}

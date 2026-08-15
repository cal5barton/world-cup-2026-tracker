import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';
import {
  COUNTRY_BY_CODE,
  SECTION_LABELS,
  SECTION_ORDER,
  getStickerSectionKey,
} from '../data/album-structure';
import StickerCard from './StickerCard';
import { request } from './TradeManager';

type TradeSticker = {
  id: number;
  number: number;
  name: string;
  country: string;
  country_code: string;
  page_number?: number;
  section_type?: string;
  image_url?: string | null;
  offer_id: string | null;
  offering_user_id: string | null;
  offering_email: string | null;
};

type TradeOffer = {
  id: string;
  userId: string;
  email: string;
};

type TradeData = {
  tradeId: string;
  creatorEmail: string;
  joinedUserEmail?: string | null;
  stickers?: TradeSticker[];
};

type Props = {
  token: string;
  trade: TradeData;
  onRefresh: () => Promise<void>;
};

function displayCode(sticker: TradeSticker): string {
  if (sticker.country_code === 'WP') return 'WP-00';
  return `${sticker.country_code}-${sticker.number}`;
}

export default function TradeAlbum({ token, trade, onRefresh }: Props) {
  const [userId, setUserId] = useState('');
  const [offers, setOffers] = useState<Record<number, TradeOffer[]>>({});
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const stickers = trade.stickers ?? [];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? '');
    });
  }, []);

  useEffect(() => {
    const next: Record<number, TradeOffer[]> = {};
    for (const sticker of stickers) {
      const existing = next[sticker.id] ?? [];
      if (sticker.offer_id && sticker.offering_user_id) {
        existing.push({
          id: sticker.offer_id,
          userId: sticker.offering_user_id,
          email: sticker.offering_email ?? 'your trading partner',
        });
      }
      next[sticker.id] = existing;
    }
    setOffers(next);
  }, [trade]);

  const visibleStickers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return stickers.filter((sticker) => {
      const stickerSection = getStickerSectionKey(sticker.country_code, sticker.number);
      if (section !== 'all' && stickerSection !== section) return false;
      if (!normalizedQuery) return true;
      return `${sticker.name} ${sticker.country} ${sticker.country_code} ${sticker.number}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, section, stickers]);

  const grouped = useMemo(() => {
    const groups = new Map<string, TradeSticker[]>();
    for (const sticker of visibleStickers) {
      const key = getStickerSectionKey(sticker.country_code, sticker.number);
      const group = groups.get(key) ?? [];
      group.push(sticker);
      groups.set(key, group);
    }
    return SECTION_ORDER
      .filter((key) => groups.has(key))
      .map((key) => [key, groups.get(key)!] as const);
  }, [visibleStickers]);

  const bringList = stickers.filter((sticker) =>
    (offers[sticker.id] ?? []).some((offer) => offer.userId === userId)
  );

  const toggleOffer = async (sticker: TradeSticker) => {
    if (!userId || busyId === sticker.id) return;
    const stickerOffers = offers[sticker.id] ?? [];
    const offeredByMe = stickerOffers.some((offer) => offer.userId === userId);
    setBusyId(sticker.id);
    setError('');
    setOffers((current) => ({
      ...current,
      [sticker.id]: offeredByMe
        ? stickerOffers.filter((offer) => offer.userId !== userId)
        : [...stickerOffers, { id: 'pending', userId, email: 'you' }],
    }));

    try {
      await request(`/api/trades/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'offer', stickerId: sticker.id, offered: !offeredByMe }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update offer');
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="trade-album">
      <header className="trade-album__header">
        <div>
          <p className="trade-kicker">Shared album</p>
          <h1>Here is what they need.</h1>
          <p className="trade-lede">Click a sticker when you can bring it. Offers are trust-based and visible to both of you.</p>
        </div>
        <div className="trade-album__partner">
          <span className="trade-kicker">Trading with</span>
          <strong>{trade.joinedUserEmail ?? trade.creatorEmail}</strong>
        </div>
      </header>

      <section className="trade-bring-list" aria-labelledby="bring-list-title">
        <div className="trade-section-heading">
          <div>
            <p className="trade-kicker">Meeting checklist</p>
            <h2 id="bring-list-title">Bring these stickers</h2>
          </div>
          <span>{bringList.length}</span>
        </div>
        {bringList.length === 0 ? (
          <p className="trade-bring-list__empty">Nothing marked yet. Choose a missing sticker below when you can fulfill it.</p>
        ) : (
          <ul className="trade-bring-list__items">
            {bringList.map((sticker) => (
              <li key={sticker.id}>
                <button type="button" onClick={() => toggleOffer(sticker)} disabled={busyId === sticker.id}>
                  <span className="trade-bring-list__code">{displayCode(sticker)}</span>
                  <span>{sticker.name}</span>
                  <span className="trade-bring-list__country">{sticker.country}</span>
                  <span className="trade-bring-list__remove">Remove</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="trade-album__controls">
        <label className="trade-album__search">
          <span className="trade-kicker">Find a sticker</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Country, number or name" />
        </label>
        <label className="trade-album__select">
          <span className="trade-kicker">Section</span>
          <select value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="all">All missing stickers</option>
            {SECTION_ORDER.filter((key) => stickers.some((sticker) => getStickerSectionKey(sticker.country_code, sticker.number) === key)).map((key) => (
              <option key={key} value={key}>{SECTION_LABELS[key] ?? key}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="trade-album__error" role="alert">{error}</p>}

      {grouped.length === 0 ? (
        <div className="trade-empty">No missing stickers match that search.</div>
      ) : grouped.map(([sectionKey, items]) => {
        const country = COUNTRY_BY_CODE[sectionKey];
        const offeredCount = items.filter((sticker) => (offers[sticker.id] ?? []).some((offer) => offer.userId === userId)).length;
        return (
          <section className="trade-album__section" key={sectionKey}>
            <header className="trade-album__section-head">
              <div>
                <p className="trade-kicker">{sectionKey}</p>
                <h2>{country?.name ?? SECTION_LABELS[sectionKey] ?? sectionKey}</h2>
              </div>
              <span>{offeredCount}/{items.length} offered by you</span>
            </header>
            <div className="sticker-grid">
              {items.map((sticker) => {
                const stickerOffers = offers[sticker.id] ?? [];
                const offeredByMe = stickerOffers.some((offer) => offer.userId === userId);
                const otherOffer = stickerOffers.find((offer) => offer.userId !== userId);
                return (
                  <StickerCard
                    key={sticker.id}
                    id={sticker.id}
                    number={sticker.number}
                    name={sticker.name}
                    country={sticker.country}
                    countryCode={sticker.country_code}
                    sectionType={sticker.section_type ?? 'regular'}
                    owned={offeredByMe}
                    displayCode={displayCode(sticker)}
                    photoUrl={sticker.image_url}
                    onToggle={() => toggleOffer(sticker)}
                    onOpenDetail={() => undefined}
                    variant="trade"
                    offerEmail={otherOffer?.email ?? null}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

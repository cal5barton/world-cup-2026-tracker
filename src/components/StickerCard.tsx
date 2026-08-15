import React from 'react';
import { COUNTRY_BY_CODE, SECTION_LABELS } from '../data/album-structure';
import type { Country } from '../data/album-structure';
import FlagBlock from './FlagBlock';

interface StickerCardProps {
  id: number;
  number: number;
  name: string;
  country: string;
  countryCode: string;
  sectionType: string;
  owned: boolean;
  displayCode: string;
  photoUrl?: string | null;
  onToggle: (id: number, owned: boolean) => void;
  onOpenDetail: (number: number) => void;
  variant?: 'collection' | 'trade';
  offerEmail?: string | null;
}

export default function StickerCard({
  id,
  number,
  name,
  country,
  countryCode,
  sectionType,
  owned,
  displayCode,
  photoUrl,
  onToggle,
  onOpenDetail,
  variant = 'collection',
  offerEmail,
}: StickerCardProps) {
  const isSpecial = sectionType === 'special';
  const countryData: Country | undefined = COUNTRY_BY_CODE[countryCode];

  const cls = [
    'sticker',
    owned ? 'is-owned' : 'is-missing',
    variant === 'trade' ? 'is-trade' : '',
    variant === 'trade' && offerEmail ? 'has-offer' : '',
    isSpecial ? 'is-special' : '',
    photoUrl ? 'has-photo' : '',
  ].filter(Boolean).join(' ');

  const specialBadge = isSpecial ? (
    countryCode === 'WP' ? 'EDT' :
    countryCode === 'FWC' && number <= 6 ? 'WC' :
    countryCode === 'FWC' ? 'HOST' : 'SPEC'
  ) : null;

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDetail(number);
  };

  const sectionLabel = countryData?.name || SECTION_LABELS[countryCode] || country;

  return (
    <div className={cls} data-sticker-id={number}>
      <button
        type="button"
        className="sticker__main"
        onClick={() => onToggle(id, !owned)}
        aria-pressed={owned}
        aria-label={`Sticker #${number} ${name} — ${owned ? 'you can bring this' : 'missing'}, click to ${owned ? 'withdraw' : 'offer'}`}
      >
        <div className="sticker__art">
          <div className="sticker__art-top">
            <div className="sticker__num">{displayCode}</div>
            {specialBadge && <span className="sticker__special">{specialBadge}</span>}
          </div>

          {/* Player headshot — tight top crop via CSS */}
          {photoUrl ? (
            <div className="sticker__photo">
              <img
                src={photoUrl}
                alt={name}
                className="sticker__photo-img"
                loading="lazy"
                draggable={false}
              />
            </div>
          ) : countryData ? (
            <div className="sticker__flag-feature">
              <FlagBlock country={countryData} size="hero" />
            </div>
          ) : (
            <div className="sticker__flag-feature sticker__flag-feature--blank">
              <span className="mono">WC · 26</span>
            </div>
          )}

          {/* Country band */}
          <div className="sticker__flag-band">
            {countryData ? (
              <>
                <span className="sticker__flag-band-bars" aria-hidden="true">
                  {countryData.stripes.map((c: string, i: number) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </span>
                <span className="sticker__flag-band-code">{countryData.code}</span>
              </>
            ) : (
              <span className="sticker__flag-band-code" style={{ marginLeft: 'auto' }}>
                {countryCode}
              </span>
            )}
          </div>

          {owned && <span className="sticker__owned-mark" aria-hidden="true">✓</span>}
        </div>

        <div className="sticker__info">
          <span className="sticker__name">{name}</span>
          <span className="sticker__country">
            {variant === 'trade' && owned
              ? 'You can bring this'
              : variant === 'trade' && offerEmail
                ? `Offered by ${offerEmail}`
                : sectionLabel}
          </span>
        </div>
      </button>

      <button
        type="button"
        className="sticker__info-btn"
        onClick={handleInfoClick}
        aria-label={`Open details for sticker #${number}`}
        title="Details"
      >?</button>
    </div>
  );
}

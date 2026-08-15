import React, { useEffect } from 'react';
import { COUNTRY_BY_CODE, SECTION_LABELS, getStickerType } from '../data/album-structure';
import FlagBlock from './FlagBlock';

interface ModalSticker {
  id: number;
  number: number;
  name: string;
  country: string;
  countryCode: string;
  pageNumber: number;
  sectionType: string;
  imageUrl?: string;
  displayCode: string;
}

interface StickerDetailModalProps {
  sticker: ModalSticker;
  owned: boolean;
  onClose: () => void;
  onToggle: (id: number, owned: boolean) => void;
}

export default function StickerDetailModal({ sticker, owned, onClose, onToggle }: StickerDetailModalProps) {
  // Close on Escape, lock body scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const country = sticker.countryCode && COUNTRY_BY_CODE[sticker.countryCode]
    ? COUNTRY_BY_CODE[sticker.countryCode]
    : null;

  const stickerType = getStickerType(sticker.name, sticker.countryCode, sticker.number);
  const { displayCode } = sticker;
  const photoUrl: string | null = sticker.imageUrl ?? null;

  const typeLabel =
      stickerType === 'cover'   ? 'Cover Edition'
    : stickerType === 'emblem'  ? 'Tournament · Emblem'
    : stickerType === 'mascot'  ? 'Tournament · Mascot'
    : stickerType === 'slogan'  ? 'Tournament · Slogan'
    : stickerType === 'ball'    ? 'Tournament · Match Ball'
    : stickerType === 'trophy'  ? 'Tournament · Trophy'
    : stickerType === 'host'    ? 'Host Nation'
    : stickerType === 'squad'   ? `${country?.name || ''} · Team Photo`
    : stickerType === 'player'  ? `${country?.name || ''} · Player`
    : 'Sticker';

  const photoLabel =
      stickerType === 'player'  ? 'PLAYER PHOTO'
    : stickerType === 'squad'   ? 'TEAM PHOTO'
    : stickerType === 'host'    ? 'HOST EMBLEM'
    : stickerType === 'mascot'  ? 'MASCOT ART'
    : stickerType === 'emblem'  ? 'EMBLEM ART'
    : stickerType === 'trophy'  ? 'TROPHY ART'
    : stickerType === 'ball'    ? 'MATCH BALL'
    : stickerType === 'slogan'  ? 'SLOGAN ART'
    : 'COVER ART';

  const sectionLabel = SECTION_LABELS[sticker.countryCode] || sticker.country;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Sticker ${sticker.number} details`}>
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__card">
        {/* Header */}
        <header className="modal__head">
          <div className="modal__head-left">
            <span className="mono modal__id">{displayCode}</span>
            <span className="modal__type mono">{typeLabel}</span>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="modal__body">
          {/* Photo (left) */}
          <div className="modal__photo">
            <div className="modal__photo-frame" aria-label={photoUrl ? sticker.name : 'Photo placeholder'}>
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={sticker.name}
                  className="modal__photo-img"
                  draggable={false}
                />
              ) : (
                <>
                  <span className="modal__photo-label mono">{photoLabel}</span>
                  <span className="modal__photo-hint mono">drop {displayCode}.jpg here</span>
                  {country && (
                    <div className="modal__photo-flag" aria-hidden="true">
                      <FlagBlock country={country} size="md" />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={`modal__status ${owned ? 'is-owned' : ''}`}>
              <span className="mono">STATUS</span>
              <strong>{owned ? 'IN COLLECTION' : 'MISSING'}</strong>
            </div>
          </div>

          {/* Info column */}
          <div className="modal__info">
            <h2 className="modal__name">{sticker.name}</h2>

            {country && (
              <div className="modal__country">
                <FlagBlock country={country} size="lg" />
                <div>
                  <div className="modal__country-name">{country.name}</div>
                  <div className="modal__country-meta mono">
                    {country.code} · {country.region}
                    {country.host ? ' · HOST' : ''}
                  </div>
                </div>
              </div>
            )}

            <dl className="modal__facts">
              <div className="modal__fact">
                <dt className="mono">Section</dt>
                <dd>{sectionLabel}</dd>
              </div>
              <div className="modal__fact">
                <dt className="mono">Sticker N°</dt>
                <dd>{displayCode}</dd>
              </div>
              <div className="modal__fact">
                <dt className="mono">Type</dt>
                <dd style={{ textTransform: 'capitalize' }}>{stickerType}</dd>
              </div>
              {sticker.sectionType === 'special' && (
                <div className="modal__fact">
                  <dt className="mono">Variant</dt>
                  <dd>Special</dd>
                </div>
              )}
              {sticker.pageNumber && (
                <div className="modal__fact">
                  <dt className="mono">Page</dt>
                  <dd>{sticker.pageNumber}</dd>
                </div>
              )}
            </dl>

            <div className="modal__actions">
              <button
                className={`btn ${owned ? '' : 'btn--primary'}`}
                onClick={() => onToggle(sticker.id, !owned)}
              >
                {owned ? 'Remove from collection' : 'Mark as owned'}
              </button>
            </div>

            <p className="modal__note">
              Player photos and emblems will be added when official artwork releases.
              This placeholder remains until you drop in your own scan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

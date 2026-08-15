import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

type TradeSummary = {
  id: string;
  status: 'active' | 'revoked';
  createdAt: string;
  revokedAt: string | null;
  participantEmail: string | null;
  shareUrl?: string;
};

type JoinRequest = {
  request_id: string;
  requester_email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

type TradeSticker = {
  id: number;
  number: number;
  name: string;
  country: string;
  country_code: string;
  offer_id: string | null;
  offering_user_id: string | null;
  offering_email: string | null;
};

type TradeResponse = {
  status: 'available' | 'pending' | 'rejected' | 'approved';
  tradeId: string;
  creatorEmail: string;
  joinedUserEmail?: string | null;
  requestId?: string | null;
  requests?: JoinRequest[];
  stickers?: TradeSticker[];
};

type Props = { token?: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/auth/login';
    throw new Error('Sign-in required');
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Trade request failed');
  return body as T;
}

export default function TradeManager({ token }: Props) {
  const [trades, setTrades] = useState<TradeSummary[]>([]);
  const [trade, setTrade] = useState<TradeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdLink, setCreatedLink] = useState('');

  const loadTrades = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await request<{ data: TradeSummary[] }>('/api/trades');
      setTrades(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trades');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrade = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const response = await request<{ data: TradeResponse }>(`/api/trades/${encodeURIComponent(token)}`);
      setTrade(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade not found');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadTrade();
    else void loadTrades();
  }, [loadTrade, loadTrades, token]);

  const createTrade = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await request<{ data: { shareUrl: string } }>('/api/trades', { method: 'POST' });
      setCreatedLink(response.data.shareUrl);
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create trade');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const sendAction = async (action: string, body: Record<string, unknown> = {}) => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await request(`/api/trades/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify({ action, ...body }),
      });
      await loadTrade();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update trade');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="trade-page-state mono">Loading trade desk...</div>;

  if (error) {
    return (
      <section className="trade-page-state trade-page-state--error">
        <p>{error}</p>
        <button className="trade-button trade-button--quiet" onClick={token ? loadTrade : loadTrades}>Try again</button>
      </section>
    );
  }

  if (!token) {
    return (
      <main className="trade-manager">
        <header className="trade-manager__header">
          <div>
            <p className="trade-kicker">Trade desk</p>
            <h1>Make the swap easier.</h1>
            <p className="trade-lede">Invite one collector, compare missing stickers, and agree on what to bring.</p>
          </div>
          <button className="trade-button trade-button--primary" disabled={busy} onClick={createTrade}>
            {busy ? 'Creating...' : 'Create trade link'}
          </button>
        </header>

        {createdLink && (
          <section className="trade-callout">
            <div>
              <p className="trade-kicker">Invitation ready</p>
              <strong>Send this link to your trading partner.</strong>
            </div>
            <div className="trade-link-row">
              <input readOnly value={createdLink} aria-label="Trade invitation link" />
              <button className="trade-button trade-button--quiet" onClick={() => copyLink(createdLink)}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </section>
        )}

        <section className="trade-list">
          <div className="trade-section-heading">
            <p className="trade-kicker">Your trades</p>
            <span>{trades.length}</span>
          </div>
          {trades.length === 0 ? (
            <div className="trade-empty">No trade links yet. Create one when you are ready to swap.</div>
          ) : trades.map((item) => (
            <article className="trade-row" key={item.id}>
              <div>
                <strong>{item.participantEmail ?? 'Waiting for a partner'}</strong>
                <p>Created {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="trade-row__actions">
                <span className={`trade-status trade-status--${item.status}`}>{item.status}</span>
                {item.shareUrl && <a className="trade-button trade-button--quiet" href={item.shareUrl}>Open</a>}
              </div>
            </article>
          ))}
        </section>
      </main>
    );
  }

  if (!trade) return null;

  if (trade.status === 'available') {
    return (
      <main className="trade-manager trade-manager--narrow">
        <p className="trade-kicker">Trade invitation</p>
        <h1>Join this sticker swap?</h1>
        <p className="trade-lede">{trade.creatorEmail} wants to compare missing stickers with you.</p>
        <button className="trade-button trade-button--primary" disabled={busy} onClick={() => sendAction('join')}>
          {busy ? 'Sending...' : 'Request to join'}
        </button>
      </main>
    );
  }

  if (trade.status === 'pending' || trade.status === 'rejected') {
    return (
      <main className="trade-manager trade-manager--narrow">
        <p className="trade-kicker">Trade invitation</p>
        <h1>{trade.status === 'pending' ? 'Request sent.' : 'Request declined.'}</h1>
        <p className="trade-lede">
          {trade.status === 'pending'
            ? `Waiting for ${trade.creatorEmail} to approve your request.`
            : 'This invitation is still available to another collector.'}
        </p>
      </main>
    );
  }

  const pendingRequests = (trade.requests ?? []).filter((request) => request.status === 'pending');
  const offeredCount = (trade.stickers ?? []).filter((sticker) => sticker.offering_user_id).length;

  return (
    <main className="trade-manager">
      <header className="trade-manager__header">
        <div>
          <p className="trade-kicker">Active trade</p>
          <h1>Compare, then pack.</h1>
          <p className="trade-lede">{trade.joinedUserEmail ?? trade.creatorEmail} · {offeredCount} offers marked</p>
        </div>
        <button className="trade-button trade-button--danger" disabled={busy} onClick={() => sendAction('revoke')}>
          Revoke trade
        </button>
      </header>

      {pendingRequests.length > 0 && (
        <section className="trade-callout">
          <div className="trade-section-heading"><p className="trade-kicker">Join requests</p><span>{pendingRequests.length}</span></div>
          {pendingRequests.map((request) => (
            <div className="trade-request" key={request.request_id}>
              <strong>{request.requester_email}</strong>
              <div className="trade-row__actions">
                <button className="trade-button trade-button--quiet" disabled={busy} onClick={() => sendAction('reject', { requestId: request.request_id })}>Reject</button>
                <button className="trade-button trade-button--primary" disabled={busy} onClick={() => sendAction('approve', { requestId: request.request_id })}>Approve</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="trade-callout trade-callout--muted">
        <p className="trade-kicker">Next step</p>
        <strong>Open the shared album to mark what you can bring.</strong>
        <p className="trade-note">The album view is the next part of the trade flow. Offers are trusted claims, so bring only what you have set aside.</p>
      </section>
    </main>
  );
}

<style>{`
  .trade-manager { max-width: 980px; margin: 0 auto; padding: 64px 28px 96px; }
  .trade-manager--narrow { max-width: 640px; }
  .trade-manager__header { display: flex; align-items: end; justify-content: space-between; gap: 28px; border-bottom: 1px solid var(--rule); padding-bottom: 30px; }
  .trade-manager h1 { margin: 8px 0 0; font-family: var(--font-display); font-size: clamp(42px, 6vw, 76px); line-height: .92; letter-spacing: var(--display-tracking); }
  .trade-lede { max-width: 560px; margin: 18px 0 0; color: var(--ink-2); font-size: 16px; line-height: 1.55; }
  .trade-kicker { margin: 0; color: var(--accent); font: 11px var(--font-mono); letter-spacing: .16em; text-transform: uppercase; }
  .trade-button { border: 1px solid var(--rule); border-radius: var(--radius); padding: 10px 14px; font: 12px var(--font-mono); letter-spacing: .04em; cursor: pointer; white-space: nowrap; }
  .trade-button:disabled { cursor: wait; opacity: .55; }
  .trade-button--primary { color: var(--bg); background: var(--ink); border-color: var(--ink); }
  .trade-button--quiet { color: var(--ink); background: var(--bg-elevated); }
  .trade-button--danger { color: var(--miss); background: transparent; border-color: color-mix(in oklab, var(--miss) 45%, var(--rule)); }
  .trade-callout { margin-top: 28px; padding: 20px; border: 1px solid var(--rule); background: var(--bg-elevated); }
  .trade-callout--muted { background: transparent; }
  .trade-callout strong { display: block; margin-top: 8px; }
  .trade-link-row { display: flex; gap: 8px; margin-top: 14px; }
  .trade-link-row input { min-width: 0; flex: 1; border: 1px solid var(--rule); background: var(--bg); color: var(--ink-2); padding: 10px; font: 12px var(--font-mono); }
  .trade-list { margin-top: 54px; }
  .trade-section-heading { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--rule); padding-bottom: 10px; }
  .trade-section-heading > span { color: var(--muted); font: 12px var(--font-mono); }
  .trade-row, .trade-request { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 18px 0; border-bottom: 1px solid var(--rule); }
  .trade-row p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  .trade-row__actions { display: flex; align-items: center; gap: 8px; }
  .trade-status { color: var(--muted); font: 11px var(--font-mono); text-transform: uppercase; letter-spacing: .08em; }
  .trade-status--active { color: var(--ok); }
  .trade-status--revoked { color: var(--miss); }
  .trade-empty, .trade-page-state { padding: 44px 0; color: var(--muted); }
  .trade-page-state { text-align: center; }
  .trade-page-state--error { color: var(--miss); }
  .trade-note { margin: 12px 0 0; color: var(--ink-2); font-size: 13px; line-height: 1.5; }
  @media (max-width: 680px) {
    .trade-manager { padding: 40px 18px 72px; }
    .trade-manager__header, .trade-row, .trade-request { align-items: flex-start; flex-direction: column; }
    .trade-manager__header .trade-button { align-self: stretch; }
    .trade-row__actions { flex-wrap: wrap; }
    .trade-link-row { align-items: stretch; flex-direction: column; }
  }
`}</style>

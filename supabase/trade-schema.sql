-- World Cup 2026 Tracker - Trade Sharing MVP
-- Run after supabase/schema.sql in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== TRADE LINKS =====
-- The token is shared only through the copied invitation URL. It is not a
-- substitute for authentication: every trade operation also requires auth.
CREATE TABLE IF NOT EXISTS trade_links (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at  TIMESTAMP WITH TIME ZONE,
  joined_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (joined_user_id IS NULL OR joined_user_id <> creator_id),
  CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_trade_links_creator_id
  ON trade_links(creator_id);
CREATE INDEX IF NOT EXISTS idx_trade_links_joined_user_id
  ON trade_links(joined_user_id);

-- A pair can have at most one active trade. This prevents duplicate active
-- trades while allowing either user to create a new trade after revocation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_links_active_creator_joined
  ON trade_links (LEAST(creator_id, COALESCE(joined_user_id, creator_id)),
                  GREATEST(creator_id, COALESCE(joined_user_id, creator_id)))
  WHERE status = 'active' AND joined_user_id IS NOT NULL;

-- ===== TRADE JOIN REQUESTS =====
CREATE TABLE IF NOT EXISTS trade_join_requests (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trade_id     UUID NOT NULL REFERENCES trade_links(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (trade_id, requester_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_join_requests_trade_id
  ON trade_join_requests(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_join_requests_requester_id
  ON trade_join_requests(requester_id);

-- ===== TRADE OFFERS =====
-- An offer is a trusted claim that the offering user can bring the sticker.
CREATE TABLE IF NOT EXISTS trade_offers (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trade_id     UUID NOT NULL REFERENCES trade_links(id) ON DELETE CASCADE,
  offering_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id   INTEGER NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (trade_id, offering_user_id, sticker_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_offers_trade_id
  ON trade_offers(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_offering_user_id
  ON trade_offers(offering_user_id);

-- ===== SECURITY HELPERS =====
-- Security-definer helpers avoid exposing trade rows while evaluating RLS on
-- offers and join requests. The fixed search_path prevents object shadowing.
CREATE OR REPLACE FUNCTION public.is_trade_participant(target_trade_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_links
    WHERE id = target_trade_id
      AND status = 'active'
      AND (creator_id = auth.uid() OR joined_user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trade_creator(target_trade_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_links
    WHERE id = target_trade_id
      AND status = 'active'
      AND creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trade_joinable(target_trade_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_links
    WHERE id = target_trade_id
      AND status = 'active'
      AND joined_user_id IS NULL
      AND creator_id <> auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_trade_participant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trade_creator(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trade_joinable(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trade_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trade_creator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trade_joinable(UUID) TO authenticated;

-- ===== UPDATED_AT =====
DROP TRIGGER IF EXISTS update_trade_join_requests_updated_at ON trade_join_requests;
CREATE TRIGGER update_trade_join_requests_updated_at
  BEFORE UPDATE ON trade_join_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== ROW LEVEL SECURITY =====
ALTER TABLE trade_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;

-- Trade links are readable only by the creator or approved participant.
CREATE POLICY "Trade participants can read active links" ON trade_links
  FOR SELECT USING (
    auth.uid() = creator_id
    OR (status = 'active' AND auth.uid() = joined_user_id)
  );

CREATE POLICY "Users can create their own trade links" ON trade_links
  FOR INSERT WITH CHECK (auth.uid() = creator_id AND joined_user_id IS NULL);

CREATE POLICY "Creators can update their trade links" ON trade_links
  FOR UPDATE USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Requesters can read their own state; creators can review requests for their
-- trades. The joined participant is also allowed to see their own request.
CREATE POLICY "Users can read their trade join requests" ON trade_join_requests
  FOR SELECT USING (
    auth.uid() = requester_id
    OR public.is_trade_creator(trade_id)
    OR (
      public.is_trade_participant(trade_id)
      AND EXISTS (
        SELECT 1 FROM public.trade_links
        WHERE id = trade_id AND joined_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can request to join active trades" ON trade_join_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
    AND public.is_trade_joinable(trade_id)
  );

CREATE POLICY "Creators can decide trade join requests" ON trade_join_requests
  FOR UPDATE USING (public.is_trade_creator(trade_id))
  WITH CHECK (public.is_trade_creator(trade_id));

-- Offers are visible and mutable only to approved participants, and a user
-- may delete only offers they made themselves.
CREATE POLICY "Trade participants can read offers" ON trade_offers
  FOR SELECT USING (public.is_trade_participant(trade_id));

CREATE POLICY "Trade participants can create their own offers" ON trade_offers
  FOR INSERT WITH CHECK (
    auth.uid() = offering_user_id
    AND public.is_trade_participant(trade_id)
  );

CREATE POLICY "Users can withdraw their own offers" ON trade_offers
  FOR DELETE USING (
    auth.uid() = offering_user_id
    AND public.is_trade_participant(trade_id)
  );

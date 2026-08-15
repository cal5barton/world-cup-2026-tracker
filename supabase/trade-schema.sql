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
DROP POLICY IF EXISTS "Trade participants can read active links" ON trade_links;
CREATE POLICY "Trade participants can read active links" ON trade_links
  FOR SELECT USING (
    auth.uid() = creator_id
    OR (status = 'active' AND auth.uid() = joined_user_id)
  );

DROP POLICY IF EXISTS "Users can create their own trade links" ON trade_links;
CREATE POLICY "Users can create their own trade links" ON trade_links
  FOR INSERT WITH CHECK (auth.uid() = creator_id AND joined_user_id IS NULL);

DROP POLICY IF EXISTS "Creators can update their trade links" ON trade_links;
CREATE POLICY "Creators can update their trade links" ON trade_links
  FOR UPDATE USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Requesters can read their own state; creators can review requests for their
-- trades. The joined participant is also allowed to see their own request.
DROP POLICY IF EXISTS "Users can read their trade join requests" ON trade_join_requests;
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

DROP POLICY IF EXISTS "Users can request to join active trades" ON trade_join_requests;
CREATE POLICY "Users can request to join active trades" ON trade_join_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
    AND public.is_trade_joinable(trade_id)
  );

DROP POLICY IF EXISTS "Creators can decide trade join requests" ON trade_join_requests;
CREATE POLICY "Creators can decide trade join requests" ON trade_join_requests
  FOR UPDATE USING (public.is_trade_creator(trade_id))
  WITH CHECK (public.is_trade_creator(trade_id));

-- Offers are visible and mutable only to approved participants, and a user
-- may delete only offers they made themselves.
DROP POLICY IF EXISTS "Trade participants can read offers" ON trade_offers;
CREATE POLICY "Trade participants can read offers" ON trade_offers
  FOR SELECT USING (public.is_trade_participant(trade_id));

DROP POLICY IF EXISTS "Trade participants can create their own offers" ON trade_offers;
CREATE POLICY "Trade participants can create their own offers" ON trade_offers
  FOR INSERT WITH CHECK (
    auth.uid() = offering_user_id
    AND public.is_trade_participant(trade_id)
  );

DROP POLICY IF EXISTS "Users can withdraw their own offers" ON trade_offers;
CREATE POLICY "Users can withdraw their own offers" ON trade_offers
  FOR DELETE USING (
    auth.uid() = offering_user_id
    AND public.is_trade_participant(trade_id)
  );

-- ===== TRADE API FUNCTIONS =====
-- These functions are the narrow token-based boundary used by the server API.
-- They return no row for an invalid, revoked, or unauthorized token.
CREATE OR REPLACE FUNCTION public.get_trade_access_by_token(p_share_token TEXT)
RETURNS TABLE (
  trade_id UUID,
  creator_id UUID,
  creator_email TEXT,
  joined_user_id UUID,
  joined_user_email TEXT,
  request_id UUID,
  request_status TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    t.id,
    t.creator_id,
    creator.email,
    t.joined_user_id,
    joined.email,
    request.id,
    request.status
  FROM public.trade_links t
  JOIN auth.users creator ON creator.id = t.creator_id
  LEFT JOIN auth.users joined ON joined.id = t.joined_user_id
  LEFT JOIN public.trade_join_requests request
    ON request.trade_id = t.id AND request.requester_id = auth.uid()
  WHERE t.share_token = p_share_token
    AND t.status = 'active'
    AND (
      t.creator_id = auth.uid()
      OR t.joined_user_id = auth.uid()
      OR request.id IS NOT NULL
      OR (t.joined_user_id IS NULL AND t.creator_id <> auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.request_trade_join_by_token(p_share_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_trade_id UUID;
  created_request_id UUID;
  existing_status TEXT;
  requester UUID := auth.uid();
BEGIN
  SELECT id INTO target_trade_id
  FROM public.trade_links
  WHERE share_token = p_share_token
    AND status = 'active'
    AND creator_id <> requester
    AND joined_user_id IS NULL;

  IF target_trade_id IS NULL THEN
    RAISE EXCEPTION 'Trade is unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO existing_status
  FROM public.trade_join_requests
  WHERE trade_id = target_trade_id AND requester_id = requester;

  IF existing_status IS NOT NULL THEN
    RAISE EXCEPTION 'Join request already exists' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.trade_join_requests (trade_id, requester_id)
  VALUES (target_trade_id, requester)
  RETURNING id INTO created_request_id;

  RETURN created_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_trade_join_request(
  p_request_id UUID,
  p_decision TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_trade_id UUID;
  requester UUID;
  decision TEXT := lower(p_decision);
BEGIN
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid join decision' USING ERRCODE = 'P0003';
  END IF;

  SELECT r.trade_id, r.requester_id
  INTO target_trade_id, requester
  FROM public.trade_join_requests r
  JOIN public.trade_links t ON t.id = r.trade_id
  WHERE r.id = p_request_id
    AND t.creator_id = auth.uid()
    AND t.status = 'active';

  IF target_trade_id IS NULL THEN
    RAISE EXCEPTION 'Join request is unavailable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.trade_join_requests
  SET status = decision, updated_at = NOW()
  WHERE id = p_request_id AND status = 'pending';

  IF decision = 'approved' THEN
    UPDATE public.trade_links
    SET joined_user_id = requester
    WHERE id = target_trade_id AND joined_user_id IS NULL;
  END IF;

  RETURN target_trade_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trade_view(p_trade_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH participants AS (
    SELECT
      t.id AS trade_id,
      t.creator_id,
      t.joined_user_id,
      CASE WHEN t.creator_id = auth.uid() THEN t.joined_user_id ELSE t.creator_id END AS other_user_id
    FROM public.trade_links t
    WHERE t.id = p_trade_id
      AND t.status = 'active'
      AND t.joined_user_id IS NOT NULL
      AND (t.creator_id = auth.uid() OR t.joined_user_id = auth.uid())
  ),
  missing AS (
    SELECT
      s.id,
      s.number,
      s.name,
      s.country,
      s.country_code,
      s.page_number,
      s.position_in_page,
      s.section_type,
      s.image_url,
      o.id AS offer_id,
      o.offering_user_id,
      offering.email AS offering_email
    FROM participants p
    JOIN public.stickers s ON TRUE
    LEFT JOIN public.user_profiles other_profile
      ON other_profile.user_id = p.other_user_id
    LEFT JOIN public.user_stickers owned
      ON owned.sticker_id = s.id AND owned.user_id = p.other_user_id
    LEFT JOIN public.trade_offers o
      ON o.trade_id = p.trade_id
      AND o.sticker_id = s.id
    LEFT JOIN auth.users offering ON offering.id = o.offering_user_id
    WHERE owned.id IS NULL
      AND (
        s.country_code NOT LIKE 'CCv%'
        OR s.country_code = 'CC'
        OR s.country_code = 'CC' || other_profile.album_version
      )
  )
  SELECT jsonb_build_object(
    'stickers', COALESCE((SELECT jsonb_agg(to_jsonb(missing) ORDER BY missing.number) FROM missing), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_trade_join_requests(p_trade_id UUID)
RETURNS TABLE (
  request_id UUID,
  requester_id UUID,
  requester_email TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT r.id, r.requester_id, requester.email, r.status, r.created_at
  FROM public.trade_join_requests r
  JOIN auth.users requester ON requester.id = r.requester_id
  WHERE r.trade_id = p_trade_id
    AND public.is_trade_creator(p_trade_id);
$$;

CREATE OR REPLACE FUNCTION public.leave_trade(p_trade_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trade_creator UUID;
  trade_joined_user UUID;
BEGIN
  SELECT creator_id, joined_user_id
  INTO trade_creator, trade_joined_user
  FROM public.trade_links
  WHERE id = p_trade_id AND status = 'active'
    AND (creator_id = auth.uid() OR joined_user_id = auth.uid());

  IF trade_creator IS NULL THEN
    RAISE EXCEPTION 'Trade is unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF trade_creator = auth.uid() THEN
    DELETE FROM public.trade_offers WHERE trade_id = p_trade_id;
    UPDATE public.trade_links
    SET status = 'revoked', revoked_at = NOW()
    WHERE id = p_trade_id;
    RETURN 'revoked';
  END IF;

  DELETE FROM public.trade_offers
  WHERE trade_id = p_trade_id AND offering_user_id = auth.uid();
  DELETE FROM public.trade_join_requests
  WHERE trade_id = p_trade_id AND requester_id = auth.uid();
  UPDATE public.trade_links
  SET joined_user_id = NULL
  WHERE id = p_trade_id AND joined_user_id = auth.uid();
  RETURN 'left';
END;
$$;

REVOKE ALL ON FUNCTION public.get_trade_access_by_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_trade_join_by_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_trade_join_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trade_view(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trade_join_requests(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_trade(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trade_access_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_trade_join_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_trade_join_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_join_requests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_trade(UUID) TO authenticated;

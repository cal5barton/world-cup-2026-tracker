import type { APIRoute } from 'astro';
import {
  errorResponse,
  getAuthenticatedUser,
  getDatabaseErrorStatus,
  jsonResponse,
} from '../../../utils/trade-api';

type TradeAccess = {
  trade_id: string;
  creator_id: string;
  creator_email: string;
  joined_user_id: string | null;
  joined_user_email: string | null;
  request_id: string | null;
  request_status: 'pending' | 'approved' | 'rejected' | null;
};

async function getAccess(request: Request, token: string) {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) return { response: errorResponse('Unauthorized', 401) };

  const { data, error } = await authenticated.client.rpc('get_trade_access_by_token', {
    p_share_token: token,
  });
  if (error) return { response: errorResponse('Trade not found', 404) };

  const access = (data?.[0] ?? null) as TradeAccess | null;
  if (!access) return { response: errorResponse('Trade not found', 404) };
  return { ...authenticated, access };
}

export const GET: APIRoute = async ({ request, params }) => {
  const token = params.token;
  if (!token) return errorResponse('Trade not found', 404);

  const result = await getAccess(request, token);
  if ('response' in result && result.response) return result.response;

  const { client, user, access } = result;
  const isApproved = access.joined_user_id !== null
    && (access.creator_id === user.id || access.request_status === 'approved');
  let requests: unknown[] = [];
  if (access.creator_id === user.id) {
    const { data: requestData, error: requestError } = await client.rpc('get_trade_join_requests', {
      p_trade_id: access.trade_id,
    });
    if (requestError) return errorResponse('Unable to load join requests', 500);
    requests = requestData ?? [];
  }

  if (!isApproved) {
    return jsonResponse({
      data: {
        status: access.request_status ?? 'available',
        ...(access.creator_id === user.id ? { status: 'owner' } : {}),
        tradeId: access.trade_id,
        creatorEmail: access.creator_email,
        requestId: access.request_id,
        requests,
      },
    });
  }

  const { data: view, error } = await client.rpc('get_trade_view', {
    p_trade_id: access.trade_id,
  });
  if (error) return errorResponse('Unable to load trade', 500);

  return jsonResponse({
    data: {
      status: 'approved',
      tradeId: access.trade_id,
      creatorEmail: access.creator_email,
      joinedUserEmail: access.joined_user_email,
      requests,
      ...(view ?? { stickers: [] }),
    },
  });
};

export const POST: APIRoute = async ({ request, params }) => {
  const token = params.token;
  if (!token) return errorResponse('Trade not found', 404);

  let body: {
    action?: 'join' | 'approve' | 'reject' | 'revoke' | 'offer';
    requestId?: string;
    stickerId?: number;
    offered?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  if (body.action === 'join') {
    const authenticated = await getAuthenticatedUser(request);
    if (!authenticated) return errorResponse('Unauthorized', 401);
    const { data, error } = await authenticated.client.rpc('request_trade_join_by_token', {
      p_share_token: token,
    });
    if (error) return errorResponse('Unable to request trade access', getDatabaseErrorStatus(error.message));
    return jsonResponse({ data: { requestId: data, status: 'pending' } }, 201);
  }

  const result = await getAccess(request, token);
  if ('response' in result && result.response) return result.response;
  const { client, user, access } = result;

  if (body.action === 'approve' || body.action === 'reject') {
    if (access.creator_id !== user.id) return errorResponse('Forbidden', 403);
    if (!body.requestId) return errorResponse('requestId is required', 400);
    const { error } = await client.rpc('decide_trade_join_request', {
      p_request_id: body.requestId,
      p_decision: body.action === 'approve' ? 'approved' : 'rejected',
    });
    if (error) return errorResponse('Unable to update join request', getDatabaseErrorStatus(error.message));
    return jsonResponse({ data: { status: body.action === 'approve' ? 'approved' : 'rejected' } });
  }

  if (body.action === 'revoke') {
    if (access.creator_id !== user.id) return errorResponse('Forbidden', 403);
    const { error } = await client
      .from('trade_links')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', access.trade_id)
      .eq('creator_id', user.id);
    if (error) return errorResponse('Unable to revoke trade', 500);
    return jsonResponse({ data: { status: 'revoked' } });
  }

  if (body.action === 'offer') {
    const isApproved = access.joined_user_id !== null
      && (access.creator_id === user.id || access.request_status === 'approved');
    if (!isApproved) {
      return errorResponse('Trade is not approved', 403);
    }
    if (typeof body.stickerId !== 'number' || !Number.isInteger(body.stickerId) || body.stickerId <= 0) {
      return errorResponse('stickerId is required', 400);
    }
    const stickerId = body.stickerId;

    if (body.offered === false) {
      const { error } = await client
        .from('trade_offers')
        .delete()
        .eq('trade_id', access.trade_id)
        .eq('offering_user_id', user.id)
        .eq('sticker_id', stickerId);
      if (error) return errorResponse('Unable to withdraw offer', 500);
    } else {
      const { error } = await client
        .from('trade_offers')
        .insert({
          trade_id: access.trade_id,
          offering_user_id: user.id,
          sticker_id: stickerId,
        });
      if (error) return errorResponse('Unable to create offer', getDatabaseErrorStatus(error.message));
    }
    return jsonResponse({ data: { stickerId, offered: body.offered !== false } });
  }

  return errorResponse('Unsupported action', 400);
};

import type { APIRoute } from 'astro';
import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from '../../utils/trade-api';

export const GET: APIRoute = async ({ request }) => {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) return errorResponse('Unauthorized', 401);

  const { client, user } = authenticated;
  const { data, error } = await client
    .from('trade_links')
    .select('id, creator_id, joined_user_id, status, created_at, revoked_at, share_token')
    .or(`creator_id.eq.${user.id},joined_user_id.eq.${user.id}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) return errorResponse('Unable to load trades', 500);

  const origin = new URL(request.url).origin;
  const trades = await Promise.all((data ?? []).map(async (trade) => {
    const { data: access } = await client.rpc('get_trade_access_by_token', {
      p_share_token: trade.share_token,
    });
    const details = access?.[0];
    const isCreator = trade.creator_id === user.id;
    let pendingRequests: Array<{ requester_email: string }> = [];
    if (isCreator) {
      const { data: requestData } = await client.rpc('get_trade_join_requests', {
        p_trade_id: trade.id,
      });
      const requests = (requestData ?? []) as Array<{ status: string; requester_email: string }>;
      pendingRequests = (requests ?? [])
        .filter((request) => request.status === 'pending')
        .map((request) => ({ requester_email: request.requester_email }));
    }
    return {
      id: trade.id,
      status: trade.status,
      createdAt: trade.created_at,
      revokedAt: trade.revoked_at,
      participantEmail: details
        ? (isCreator ? details.joined_user_email : details.creator_email)
        : null,
      pendingRequestCount: pendingRequests.length,
      pendingRequesterEmails: pendingRequests.map((request) => request.requester_email),
      shareUrl: `${origin}/trade/${trade.share_token}`,
    };
  }));

  return jsonResponse({ data: trades });
};

export const POST: APIRoute = async ({ request }) => {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) return errorResponse('Unauthorized', 401);

  const { client, user } = authenticated;
  const shareToken = crypto.randomUUID();
  const { data, error } = await client
    .from('trade_links')
    .insert({ creator_id: user.id, share_token: shareToken })
    .select('id, status, created_at')
    .single();

  if (error) return errorResponse('Unable to create trade', 500);

  const origin = new URL(request.url).origin;
  return jsonResponse({
    data: {
      id: data.id,
      status: data.status,
      createdAt: data.created_at,
      shareUrl: `${origin}/trade/${shareToken}`,
    },
  }, 201);
};

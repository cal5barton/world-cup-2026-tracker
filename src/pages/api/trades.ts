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
    .order('created_at', { ascending: false });

  if (error) return errorResponse('Unable to load trades', 500);

  const origin = new URL(request.url).origin;
  return jsonResponse({
    data: (data ?? []).map((trade) => ({
      id: trade.id,
      status: trade.status,
      createdAt: trade.created_at,
      revokedAt: trade.revoked_at,
      participantId: trade.creator_id === user.id ? trade.joined_user_id : trade.creator_id,
      shareUrl: trade.creator_id === user.id
        ? `${origin}/trade/${trade.share_token}`
        : undefined,
    })),
  });
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

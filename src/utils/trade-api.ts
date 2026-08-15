import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export function getBearerToken(request: Request): string | undefined {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice('Bearer '.length).trim();
  return token || undefined;
}

export function getAuthenticatedClient(request: Request): {
  client: SupabaseClient;
  token?: string;
} {
  const token = getBearerToken(request);
  const client = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
  return { client, token };
}

export async function getAuthenticatedUser(
  request: Request
): Promise<{ client: SupabaseClient; user: User } | null> {
  const { client, token } = getAuthenticatedClient(request);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return { client, user };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

export function getDatabaseErrorStatus(message: string): number {
  if (message.includes('P0002') || message.toLowerCase().includes('already exists')) return 409;
  if (message.includes('P0001') || message.includes('P0003')) return 400;
  if (message.toLowerCase().includes('duplicate')) return 409;
  return 500;
}

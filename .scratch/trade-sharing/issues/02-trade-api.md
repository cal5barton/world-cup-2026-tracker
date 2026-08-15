# 02 Trade API

## Goal
Expose authenticated endpoints for creating and managing trade links, join requests, participants, and offers without leaking private collection data.

## Blocking edges
- Blocks on 01 Trade schema and RLS.

## Scope
- Create a trade and return a share URL containing an unguessable token.
- List the current user's created/participating trades.
- Resolve a token for the authenticated user without exposing token internals.
- Submit, approve, and reject join requests.
- Revoke a creator-owned trade.
- Return approved-participant emails, current missing sticker data for each side, and offers.
- Create and withdraw offers for the authenticated participant.
- Use consistent unauthorized, forbidden, not-found, conflict, and validation responses.

## Acceptance criteria
- Every endpoint derives identity from the bearer session.
- A pending requester receives no missing stickers, owned stickers, or offers.
- A third authenticated user cannot inspect or mutate a trade after opening its URL.
- A trade cannot accept a second participant or duplicate active pairing.
- Revocation blocks reads and writes.
- Invalid/expired/revoked tokens do not reveal whether a trade exists.

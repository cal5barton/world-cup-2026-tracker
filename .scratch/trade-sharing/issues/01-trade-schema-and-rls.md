# 01 Trade schema and RLS

## Goal
Create the persistent trade, join-request, and offer model with database-enforced privacy.

## Blocking edges
None.

## Scope
- Add migrations/schema SQL for active/revoked trade links, join requests, and offers.
- Add constraints for two participants, one active pairing per user pair, and one offer per user/sticker/trade.
- Add indexes for token lookup, creator/requester lookup, and trade offers.
- Add RLS policies matching `.scratch/trade-sharing/SPEC.md`.
- Document how the schema is applied to an existing Supabase project.

## Acceptance criteria
- Pending users cannot read collection or offers.
- Only approved participants can read trade-scoped data.
- Creator-only approval/revocation and owner-only offer mutation are enforced by RLS or controlled server operations.
- A revoked trade cannot be read or mutated by either participant.
- Existing sticker and user collection policies remain intact.

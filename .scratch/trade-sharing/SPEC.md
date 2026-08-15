# Trade Sharing MVP

## Outcome

A signed-in collector can create a private two-person trade link. A second signed-in collector requests access, the creator approves them, and both users can view each other's current missing stickers in an album-style view. Either participant can click a sticker in the other person's missing list to say they can provide it; clicking again withdraws that offer.

## Decisions

- Access requires authentication and the unguessable trade link.
- The creator must approve the joining user.
- Each trade has exactly two participants.
- A creator may have multiple active trades, but only one active trade with a given other user.
- Before approval, the requester sees no collection data.
- After approval, both participants see each other's missing stickers, not full owned collections.
- Offers are trust-based. The app does not verify duplicate inventory or require duplicate records.
- Offers are visible to both participants, and only the user who made an offer can withdraw it.
- Each participant has a meeting-ready bring list of their active offers, labeled with the sticker country and album number, with the sticker name where useful.
- Collection data is calculated from the current `user_stickers` rows on each load.
- The MVP has no exchanged/completed state and no plain-text export.
- Revocation removes access immediately. Rejected requests leave the invitation usable for another signed-in user.
- Participants are identified by Supabase Auth email.

## User Flows

### Create and share

1. An authenticated user chooses Create trade from the tracker.
2. The app creates an active trade link and displays a copyable URL.
3. The creator can see pending requests and active trades, and can revoke a trade.

### Request and approve

1. An authenticated user opens a trade URL.
2. If they are the creator, they see the trade management view.
3. If they are not a participant, they can request to join.
4. The creator sees the requester email and approves or rejects the request.
5. A rejected requester sees the rejection state; the link remains available to other users.
6. An approved participant sees the shared trade album.

### Shared trade album

1. Each participant sees the other participant's current missing stickers in the existing album structure.
2. A missing sticker is selectable as an offer.
3. Selecting it creates an offer attributed to the current user.
4. Selecting an offered sticker again withdraws that user's offer.
5. The trade view includes a concise bring list of the current user's active offers.
6. The offer state is visible to both participants after refresh (realtime is not required for the MVP).

## Data and Security Contract

Add trade-specific tables and RLS policies for:

- trade links with creator, token, active/revoked state, and optional joined participant;
- join requests with requester and pending/approved/rejected state;
- offers keyed by trade, offering user, and requested sticker.

Only approved participants may read the other participant's missing stickers or trade offers. A pending requester may read only their request state. A user may create or withdraw only their own offers. A creator may approve/reject requests and revoke their own trade. Sticker catalog reads remain public.

The share token must be cryptographically unguessable. APIs must not accept a user ID as authority for either participant; identity comes from the authenticated Supabase session.

## Acceptance Criteria

- An unauthenticated visitor is redirected or receives an unauthorized response and cannot inspect a trade.
- A creator can create, copy, list, and revoke trade links.
- A second authenticated user can request to join a link.
- The creator can approve or reject the pending request.
- No collection or offer data is returned before approval.
- A trade cannot have more than two participants.
- The same two users cannot create/join duplicate active trades.
- Approved participants can each see the other's missing stickers in an album-like layout.
- Clicking a missing sticker creates an offer; clicking it again removes that user's offer.
- Each offer displays who offered it and is visible to both participants.
- Each participant can quickly scan a bring list of the stickers they offered, using country and album number to prepare duplicates before meeting in person.
- Offers remain independent from later collection changes; the displayed missing albums are recalculated on load.
- Revoking a trade prevents both participants from loading its data or changing offers.
- Existing tracker collection behavior remains unchanged.

## Out of Scope

- Public or unauthenticated trade pages.
- User search, friend lists, or direct messaging.
- Duplicate inventory management or offer verification.
- Trade completion, exchanged, declined, or history states.
- More than two participants.
- Plain-text missing-list export.
- Realtime synchronization.
- Display names beyond email.

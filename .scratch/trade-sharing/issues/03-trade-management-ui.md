# 03 Trade management UI

## Goal
Let authenticated users create, share, approve, reject, list, and revoke their two-person trade links.

## Blocking edges
- Blocks on 02 Trade API.

## Scope
- Add a trade entry point from the authenticated tracker experience.
- Add create-trade and copy-link states.
- Add active-trades list with participant email and status.
- Add pending-request list for the creator with approve/reject actions.
- Add waiting, rejected, revoked, unauthorized, loading, and error states.
- Ensure a creator can maintain separate trades with different users.

## Acceptance criteria
- A creator can copy a usable link without exposing a raw secret in unrelated UI.
- A requester sees a clear pending state after submitting a join request.
- Approval transitions both participants to the shared trade view.
- Rejection does not disable the link for another user.
- Revocation is explicit and visibly removes the trade from active state.
- Buttons are disabled while their request is in flight and errors are recoverable.

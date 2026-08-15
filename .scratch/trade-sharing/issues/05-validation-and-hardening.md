# 05 Validation and hardening

## Goal
Verify the complete two-person trade flow and protect existing tracker behavior.

## Blocking edges
- Blocks on 01 Trade schema and RLS.
- Blocks on 02 Trade API.
- Blocks on 03 Trade management UI.
- Blocks on 04 Shared trade album.

## Scope
- Add the repository's available focused tests, or establish the smallest test harness needed for API/state logic.
- Manually verify authenticated and unauthenticated flows against a Supabase project.
- Verify creator approval/rejection, duplicate-pair prevention, revocation, and third-user isolation.
- Verify offer create/withdraw behavior for both participants.
- Verify the bring list contains every active offer with the correct country and album number and updates after an offer is withdrawn.
- Run TypeScript/build validation and check mobile album layout.
- Update README/setup notes with required SQL and environment assumptions.

## Acceptance criteria
- The full acceptance list in `SPEC.md` passes.
- `npm run build` succeeds.
- Existing collection tracking still loads and toggles correctly.
- No endpoint or client response exposes another user's full owned collection.
- The share token is not logged or rendered outside the copy/share flow.

# 04 Shared trade album

## Goal
Reuse the existing album experience to show the other participant's missing stickers and let the current user make or withdraw trusted offers.

## Blocking edges
- Blocks on 02 Trade API.
- Blocks on 03 Trade management UI for navigation and approved trade state.

## Scope
- Extract or adapt the existing album grouping/filtering/card behavior for a read-only missing-sticker mode.
- Render the other participant's missing stickers using current collection data.
- Make missing stickers clickable as offer toggles.
- Show offer attribution and distinguish offered/unoffered states.
- Add a prominent, compact bring list for the current user's active offers, showing country, album number, and sticker name where useful.
- Keep the bring list easy to scan while preparing stickers for an in-person meeting.
- Keep the user's own collection hidden in the trade view.
- Support refresh after collection changes; realtime is not required.
- Preserve album version filtering where applicable.

## Acceptance criteria
- The view contains only the other participant's currently missing stickers.
- Clicking a sticker creates an offer for the authenticated participant.
- Clicking that offered sticker again withdraws only the authenticated participant's offer.
- Both participants can see offer state after reload.
- Each participant can identify exactly what to bring from a dedicated list using country and album number, without searching the album again.
- The UI does not imply that the app verified the offer is a duplicate.
- Existing tracker album interactions and collection updates remain unchanged.

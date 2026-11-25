# Security Specification — Al-Utrujjah P2P Duo Recitation & Friends Calling

## 1. Data Invariants
1. **Owner-Only PII Isolation**: Private profile documents under `/users/{userId}/private/profile` can only be read or written by the authenticated user whose `uid === userId` and `email_verified === true`.
2. **Zero-PII Friend Lookup**: `/userDirectory/{lookupId}` stores only `{ lookupId, uid, displayName, updatedAt }` with `allow list: if false`. Users cannot scrape other users or read emails; they can only resolve a friend via an exact UID or SHA-256 hash of a known email.
3. **Owner-Scoped Friends List**: `/users/{userId}/friends/{friendUid}` can only be read, listed, created, or deleted by `userId == request.auth.uid`, and `friendUid` must exist in `/userDirectory/{friendUid}` and cannot equal `userId`.
4. **Signaling & Direct Call Integrity**: `/duoSessions/{sessionId}` requires `hostUid == request.auth.uid`, valid bounded ranges, and server timestamps (`request.time`). Direct friend calls must start in `status == 'ringing'` with a valid existing `calleeUid != hostUid`.
5. **Scoped Incoming Call Listener**: `allow list` on `/duoSessions` strictly requires `resource.data.calleeUid == request.auth.uid`, preventing any client from listing rooms or other users' calls.
6. **Terminal State Lock**: Once `status` reaches `'ended'` or `'declined'`, no further updates are permitted.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/uid1/private/profile` or `/users/uid1/friends/uid2`.
2. Unverified email (`email_verified: false`) writing to `/userDirectory` or creating `/duoSessions`.
3. Collection scraping via `list` on `/userDirectory` or unscoped `list` on `/duoSessions`.
4. Impersonating another user in `/userDirectory/{lookupId}` (`uid: 'someoneElse'`).
5. Adding a non-existent `friendUid` to `/users/uid1/friends/fakeUid` (orphan record blocked by `exists()`).
6. Calling a non-existent `calleeUid` or calling oneself (`calleeUid == hostUid`).
7. Shadow field injection ("Ghost Field"): adding `isAdmin: true` to `/duoSessions/room1` or `/users/uid1/friends/uid2`.
8. Hijacking another user's `ringing` call (`uid3` attempting to answer a call whose `calleeUid == 'uid2'`).
9. Modifying `hostUid`, `sessionId`, `calleeUid`, or `createdAt` during an `update`.
10. State shortcutting: creating a call directly with `status: 'active'` or `'ended'`.
11. Resource poisoning: sending a 1MB string in `offerSdp`, `friendName`, or `displayName`.
12. Post-terminal mutation: updating a call/session after `status == 'ended'` or `'declined'`.

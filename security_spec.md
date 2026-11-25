# Security Specification — Al-Utrujjah P2P Duo Recitation & Friends Calling

## 1. Data Invariants
1. **Owner-Only PII Isolation**: Private profile documents under `/users/{userId}/private/profile` can only be read or written by the authenticated user whose `uid === userId` and `email_verified === true`.
2. **Zero-PII Friend Lookup**: `/userDirectory/{lookupId}` stores only `{ lookupId, uid, displayName, lastSeen, updatedAt }` with `allow list: if false`.
3. **Consent-Gated Friends**: `/users/{userId}/friends/{friendUid}` requires an accepted `/friendRequests` document via `existsAfter` / `getAfter` and cannot reference `userId`.
4. **Signaling & Direct Call Integrity**: `/duoSessions/{sessionId}` requires `hostUid == request.auth.uid`, valid bounded ranges, approved friendship `exists()`, and server timestamps (`request.time`). Direct friend calls must start in `status == 'ringing'` with `calleeUid != hostUid`.
5. **Safe Optional Field Evaluation**: All optional fields on `duoSessions` (such as `guestUid`) are guarded with `'guestUid' in existing()` before property dereference so callee `get` and `update` rules never fail on ringing documents.
6. **Scoped Listeners**: `allow list` on `/duoSessions` strictly requires `resource.data.calleeUid == request.auth.uid || resource.data.hostUid == request.auth.uid`.
7. **Trickle ICE Isolation**: `/duoSessions/{sessionId}/candidates/{candidateId}` enforces Master Gate `get()` on the parent `duoSessions/{sessionId}` during `create` so only active/ringing participants can exchange ICE candidates, while `list` evaluates `resource.data.recipientUid == request.auth.uid || resource.data.senderUid == request.auth.uid` with zero DB lookups.
8. **Terminal State Lock**: Once `status` reaches `'ended'` or `'declined'`, no further updates are permitted.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/uid1/private/profile` or `/users/uid1/friends/uid2`.
2. Unverified email (`email_verified: false`) writing to `/userDirectory` or creating `/duoSessions`.
3. Collection scraping via `list` on `/userDirectory` or unscoped `list` on `/duoSessions` or `/candidates`.
4. Impersonating another user in `/userDirectory/{lookupId}` (`uid: 'someoneElse'`).
5. Adding a friend to `/users/uid1/friends/uid2` without an accepted `friendRequests` document.
6. Calling a non-friend `calleeUid` or calling oneself (`calleeUid == hostUid`).
7. Shadow field injection ("Ghost Field"): adding `isAdmin: true` to `/duoSessions/room1` or `/candidates/c1`.
8. Hijacking another user's `ringing` call (`uid3` attempting to answer a call whose `calleeUid == 'uid2'`).
9. Modifying `hostUid`, `sessionId`, `calleeUid`, or `createdAt` during an `update`.
10. State shortcutting: creating a call directly with `status: 'active'` or `'ended'`.
11. Resource poisoning: sending a 1MB string in `offerSdp`, `candidate`, `friendName`, or `displayName`.
12. Post-terminal mutation: updating a call/session or adding ICE candidates after `status == 'ended'` or `'declined'`.

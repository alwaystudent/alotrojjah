import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { QuranRiwayah } from '../data/quranData';

export interface FriendContactItem {
  friendUid: string;
  friendName: string;
  note?: string;
}

export interface FriendInviteDoc {
  inviteToken: string;
  ownerUid: string;
  ownerName: string;
  status: 'open' | 'revoked';
}

export interface FriendRequestDoc {
  requestId: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  inviteToken: string;
  status: 'pending' | 'accepted' | 'declined';
  syncedBySender: boolean;
}

export interface IncomingDuoCall {
  sessionId: string;
  hostUid: string;
  hostName: string;
  calleeUid?: string | null;
  callMode?: 'friend_call';
  riwayah?: QuranRiwayah;
  curriculumMode?: 'surah' | 'ayah' | 'page';
  surahNumber: number;
  surahEnd?: number;
  ayahFrom: number;
  ayahTo: number;
  pageFrom?: number;
  pageTo?: number;
  offerType: string;
  offerSdp: string;
  hideVersesForReciter?: boolean;
  hideVersesForListener?: boolean;
  status: 'ringing' | 'active' | 'declined' | 'ended';
}

function generateCryptoToken(prefix: string, length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(bytes[i] % chars.length);
  }
  return `${prefix}-${out}`;
}

export function getDisplayNameForUser(user: User): string {
  const candidate =
    user.displayName?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'قارئ الأترجة';
  return candidate.slice(0, 80);
}

export function formatFriendShortCode(uid: string): string {
  const clean = (uid || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (clean.slice(0, 6) || 'USER01').padEnd(6, 'X');
  return `SRD-${suffix}`;
}

export async function syncVerifiedUserProfileAndDirectory(user: User): Promise<void> {
  if (!user.emailVerified) return;

  const safeName = getDisplayNameForUser(user);
  const safeEmail = (user.email || `${user.uid}@user.local`).slice(0, 254);

  // 1. Private Profile (strictly owner-only)
  const privatePath = `users/${user.uid}/private/profile`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'private', 'profile'), {
      uid: user.uid,
      email: safeEmail,
      displayName: safeName,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }

  // 2. Zero-PII UID Directory entry (enables verifying user display name & online heartbeat)
  const uidDirPath = `userDirectory/${user.uid}`;
  try {
    await setDoc(doc(db, 'userDirectory', user.uid), {
      lookupId: user.uid,
      uid: user.uid,
      displayName: safeName,
      lastSeen: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, uidDirPath);
  }
}

export async function updateUserPresenceHeartbeat(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const uidDirPath = `userDirectory/${user.uid}`;
  try {
    await updateDoc(doc(db, 'userDirectory', user.uid), {
      displayName: getDisplayNameForUser(user),
      lastSeen: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, uidDirPath);
  }
}

export function subscribeFriendPresence(
  friendUid: string,
  onPresence: (uid: string, online: boolean, lastSeen?: number) => void
): () => void {
  const dirPath = `userDirectory/${friendUid}`;
  return onSnapshot(
    doc(db, 'userDirectory', friendUid),
    (snap) => {
      if (!snap.exists()) {
        onPresence(friendUid, false);
        return;
      }
      const data = snap.data() as { lastSeen?: number };
      const lastSeen = typeof data.lastSeen === 'number' ? data.lastSeen : 0;
      const isOnline = lastSeen > 0 && Date.now() - lastSeen < 120_000;
      onPresence(friendUid, isOnline, lastSeen);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, dirPath);
    }
  );
}

export async function getOrCreateMyFriendInvite(user: User): Promise<FriendInviteDoc | null> {
  if (!user.emailVerified) return null;
  const invitesCol = collection(db, 'friendInvites');
  const q = query(invitesCol, where('ownerUid', '==', user.uid));

  try {
    const snap = await getDocs(q);
    const openDoc = snap.docs.find((d) => (d.data() as FriendInviteDoc).status === 'open');
    if (openDoc) {
      return openDoc.data() as FriendInviteDoc;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'friendInvites');
  }

  const newToken = generateCryptoToken('INV', 10);
  const ownerName = getDisplayNameForUser(user);
  const invitePath = `friendInvites/${newToken}`;
  try {
    await setDoc(doc(db, 'friendInvites', newToken), {
      inviteToken: newToken,
      ownerUid: user.uid,
      ownerName,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      inviteToken: newToken,
      ownerUid: user.uid,
      ownerName,
      status: 'open',
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, invitePath);
    return null;
  }
}

export async function regenerateMyFriendInvite(user: User): Promise<FriendInviteDoc | null> {
  if (!user.emailVerified) return null;
  const q = query(collection(db, 'friendInvites'), where('ownerUid', '==', user.uid));
  try {
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs
        .filter((d) => (d.data() as FriendInviteDoc).status === 'open')
        .map((d) =>
          updateDoc(d.ref, {
            status: 'revoked',
            updatedAt: serverTimestamp(),
          })
        )
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'friendInvites');
  }

  const newToken = generateCryptoToken('INV', 10);
  const ownerName = getDisplayNameForUser(user);
  const invitePath = `friendInvites/${newToken}`;
  try {
    await setDoc(doc(db, 'friendInvites', newToken), {
      inviteToken: newToken,
      ownerUid: user.uid,
      ownerName,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      inviteToken: newToken,
      ownerUid: user.uid,
      ownerName,
      status: 'open',
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, invitePath);
    return null;
  }
}

export async function fetchFriendInviteDetails(
  tokenOrUrl: string
): Promise<FriendInviteDoc | null> {
  let clean = tokenOrUrl.trim();
  if (!clean) return null;

  // Allow pasting a full invite URL (?invite=... or ?friendInvite=...) or raw token
  if (clean.includes('friendInvite=') || clean.includes('invite=')) {
    try {
      const parsed = new URL(clean);
      clean =
        parsed.searchParams.get('friendInvite') ||
        parsed.searchParams.get('invite') ||
        clean;
    } catch {
      const m = clean.match(/(?:friendInvite|invite)=([a-zA-Z0-9_\-]+)/);
      if (m?.[1]) clean = m[1];
    }
  }

  clean = clean.trim();
  if (!/^[a-zA-Z0-9_\-]{4,64}$/.test(clean)) return null;

  const path = `friendInvites/${clean}`;
  try {
    const snap = await getDoc(doc(db, 'friendInvites', clean));
    if (!snap.exists()) return null;
    const data = snap.data() as FriendInviteDoc;
    if (data.status !== 'open') return null;
    return data;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function sendConsentFriendRequest(
  currentUser: User,
  invite: FriendInviteDoc
): Promise<'sent' | 'already_pending' | 'already_accepted'> {
  const requestId = `${currentUser.uid}_${invite.ownerUid}`;
  const reverseRequestId = `${invite.ownerUid}_${currentUser.uid}`;
  const reqRef = doc(db, 'friendRequests', requestId);
  const reverseReqRef = doc(db, 'friendRequests', reverseRequestId);
  const friendRef = doc(db, 'users', currentUser.uid, 'friends', invite.ownerUid);
  const safeOwnerName = invite.ownerName?.trim().slice(0, 80) || 'قارئ';
  const reqPath = `friendRequests/${requestId}`;

  try {
    // Check if inviter already sent us a pending/accepted request in the opposite direction
    const reverseSnap = await getDoc(reverseReqRef);
    if (reverseSnap.exists()) {
      const reverseData = reverseSnap.data() as FriendRequestDoc;
      if (reverseData.status === 'pending') {
        await approveIncomingFriendRequest(currentUser, reverseData);
        return 'already_accepted';
      }
      if (reverseData.status === 'accepted') {
        const friendSnap = await getDoc(friendRef);
        if (!friendSnap.exists()) {
          await setDoc(friendRef, {
            friendUid: invite.ownerUid,
            friendName: safeOwnerName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return 'already_accepted';
      }
    }

    const existingSnap = await getDoc(reqRef);
    if (existingSnap.exists()) {
      const prev = existingSnap.data() as FriendRequestDoc;
      if (prev.status === 'pending') return 'already_pending';
      if (prev.status === 'accepted') {
        const friendSnap = await getDoc(friendRef);
        if (!friendSnap.exists() || !prev.syncedBySender) {
          const batch = writeBatch(db);
          if (!friendSnap.exists()) {
            batch.set(friendRef, {
              friendUid: invite.ownerUid,
              friendName: safeOwnerName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(friendRef, {
              friendName: safeOwnerName,
              updatedAt: serverTimestamp(),
            });
          }
          if (!prev.syncedBySender) {
            batch.update(reqRef, {
              syncedBySender: true,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
        return 'already_accepted';
      }
      // If previously declined, delete stale doc so user can re-send a fresh request
      await deleteDoc(reqRef);
    }

    await setDoc(reqRef, {
      requestId,
      fromUid: currentUser.uid,
      fromName: getDisplayNameForUser(currentUser),
      toUid: invite.ownerUid,
      toName: safeOwnerName,
      inviteToken: invite.inviteToken,
      status: 'pending',
      syncedBySender: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return 'sent';
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, reqPath);
    throw err;
  }
}

export async function approveIncomingFriendRequest(
  currentUser: User,
  req: FriendRequestDoc
): Promise<void> {
  const reqRef = doc(db, 'friendRequests', req.requestId);
  const friendRef = doc(db, 'users', currentUser.uid, 'friends', req.fromUid);

  try {
    const [reqSnap, friendSnap] = await Promise.all([getDoc(reqRef), getDoc(friendRef)]);
    const batch = writeBatch(db);
    let hasWrites = false;

    if (reqSnap.exists() && (reqSnap.data() as FriendRequestDoc).status === 'pending') {
      batch.update(reqRef, {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    }

    if (friendSnap.exists()) {
      batch.update(friendRef, {
        friendName: req.fromName.slice(0, 80),
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    } else {
      batch.set(friendRef, {
        friendUid: req.fromUid,
        friendName: req.fromName.slice(0, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `friendRequests/${req.requestId}`);
  }
}

export async function declineIncomingFriendRequest(req: FriendRequestDoc): Promise<void> {
  const reqPath = `friendRequests/${req.requestId}`;
  try {
    await updateDoc(doc(db, 'friendRequests', req.requestId), {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, reqPath);
  }
}

export async function syncAcceptedOutgoingRequest(
  currentUser: User,
  req: FriendRequestDoc
): Promise<void> {
  const friendRef = doc(db, 'users', currentUser.uid, 'friends', req.toUid);
  const reqRef = doc(db, 'friendRequests', req.requestId);

  try {
    const [reqSnap, friendSnap] = await Promise.all([getDoc(reqRef), getDoc(friendRef)]);
    if (reqSnap.exists() && (reqSnap.data() as FriendRequestDoc).syncedBySender && friendSnap.exists()) {
      return;
    }

    const batch = writeBatch(db);
    if (friendSnap.exists()) {
      batch.update(friendRef, {
        friendName: req.toName.slice(0, 80),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(friendRef, {
        friendUid: req.toUid,
        friendName: req.toName.slice(0, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (!reqSnap.exists() || !(reqSnap.data() as FriendRequestDoc).syncedBySender) {
      batch.update(reqRef, {
        syncedBySender: true,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/friends/${req.toUid}`);
  }
}

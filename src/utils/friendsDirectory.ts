import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
  return (
    user.displayName ||
    user.email?.split('@')[0] ||
    'قارئ الأترجة'
  ).slice(0, 80);
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

  // 2. Zero-PII UID Directory entry (enables verifying user display name & UID existence)
  const uidDirPath = `userDirectory/${user.uid}`;
  try {
    await setDoc(doc(db, 'userDirectory', user.uid), {
      lookupId: user.uid,
      uid: user.uid,
      displayName: safeName,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, uidDirPath);
  }
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

  // Allow pasting a full invite URL or raw token
  if (clean.includes('friendInvite=')) {
    try {
      const parsed = new URL(clean);
      clean = parsed.searchParams.get('friendInvite') || clean;
    } catch {
      const m = clean.match(/friendInvite=([a-zA-Z0-9_\-]+)/);
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
  const reqPath = `friendRequests/${requestId}`;

  try {
    const existingSnap = await getDoc(doc(db, 'friendRequests', requestId));
    if (existingSnap.exists()) {
      const prev = existingSnap.data() as FriendRequestDoc;
      if (prev.status === 'pending') return 'already_pending';
      if (prev.status === 'accepted') return 'already_accepted';
      // If previously declined, delete stale doc so user can re-send a fresh request
      await deleteDoc(doc(db, 'friendRequests', requestId));
    }

    await setDoc(doc(db, 'friendRequests', requestId), {
      requestId,
      fromUid: currentUser.uid,
      fromName: getDisplayNameForUser(currentUser),
      toUid: invite.ownerUid,
      toName: invite.ownerName.slice(0, 80),
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
  const batch = writeBatch(db);
  const reqRef = doc(db, 'friendRequests', req.requestId);
  const friendRef = doc(db, 'users', currentUser.uid, 'friends', req.fromUid);

  batch.update(reqRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });

  batch.set(friendRef, {
    friendUid: req.fromUid,
    friendName: req.fromName.slice(0, 80),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
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
  const batch = writeBatch(db);
  const friendRef = doc(db, 'users', currentUser.uid, 'friends', req.toUid);
  const reqRef = doc(db, 'friendRequests', req.requestId);

  batch.set(friendRef, {
    friendUid: req.toUid,
    friendName: req.toName.slice(0, 80),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(reqRef, {
    syncedBySender: true,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/friends/${req.toUid}`);
  }
}

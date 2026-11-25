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

export interface UserDirectoryEntry {
  lookupId: string;
  uid: string;
  displayName: string;
  lastSeen?: number;
  updatedAt?: unknown;
}

export interface FriendInviteDoc {
  inviteToken: string;
  ownerUid: string;
  ownerName: string;
  status: 'open' | 'revoked';
  createdAt?: unknown;
  updatedAt?: unknown;
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
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FriendContactDoc {
  friendUid: string;
  friendName: string;
  note?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IncomingDuoCall {
  sessionId: string;
  hostUid: string;
  hostName: string;
  guestUid?: string | null;
  guestName?: string | null;
  calleeUid: string;
  callMode: 'friend_call';
  riwayah?: 'hafs' | 'qalun' | 'warsh';
  curriculumMode?: 'surah' | 'ayah' | 'page';
  hideVersesForReciter?: boolean;
  hideVersesForListener?: boolean;
  activeAyah?: number;
  reciterSide?: 'host' | 'guest';
  mistakesCount?: number;
  markedErrors?: string[];
  endedByUid?: string | null;
  sessionEvaluation?: 'excellent' | 'very_good' | 'good_practice' | 'needs_review' | null;
  callDurationSeconds?: number | null;
  accuracyPct?: number | null;
  surahNumber: number;
  surahEnd?: number;
  ayahFrom: number;
  ayahTo: number;
  pageFrom?: number;
  pageTo?: number;
  offerType: string;
  offerSdp: string;
  answerType?: string | null;
  answerSdp?: string | null;
  status: 'ringing' | 'active' | 'declined' | 'ended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IceCandidateDoc {
  candidateId: string;
  sessionId: string;
  senderUid: string;
  recipientUid: string;
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  createdAt?: unknown;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function sanitizeDisplayName(raw: string | null | undefined, fallbackEmail?: string | null): string {
  const trimmed = (raw || '').trim();
  if (trimmed.length >= 1) {
    return trimmed.slice(0, 80);
  }
  const emailPrefix = (fallbackEmail || '').split('@')[0]?.trim();
  if (emailPrefix && emailPrefix.length >= 1) {
    return emailPrefix.slice(0, 80);
  }
  return 'مستخدم الأترجة';
}

export function getDisplayNameForUser(user: User): string {
  return sanitizeDisplayName(user.displayName, user.email);
}

export function formatFriendShortCode(uid: string): string {
  return (uid || '').slice(0, 6).toUpperCase();
}

export function extractInviteTokenFromInput(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('?')) {
    try {
      const normalized = trimmed.startsWith('http') ? trimmed : `https://alutrujjah.app/${trimmed.replace(/^\/+/, '')}`;
      const url = new URL(normalized);
      const token = url.searchParams.get('friendInvite') || url.searchParams.get('invite') || '';
      return token.trim();
    } catch {
      // fall through
    }
  }
  return trimmed;
}

function generateSecureToken(prefix: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `${prefix}_${suffix}`;
}

export async function syncVerifiedUserProfileAndDirectory(user: User): Promise<void> {
  if (!user.emailVerified || !user.email) return;
  const displayName = getDisplayNameForUser(user);
  const safeEmail = user.email.trim().slice(0, 254);

  const privateRef = doc(db, 'users', user.uid, 'private', 'profile');
  const dirRef = doc(db, 'userDirectory', user.uid);

  try {
    await setDoc(
      privateRef,
      {
        uid: user.uid,
        email: safeEmail,
        displayName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/private/profile`);
  }

  try {
    await setDoc(
      dirRef,
      {
        lookupId: user.uid,
        uid: user.uid,
        displayName,
        lastSeen: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `userDirectory/${user.uid}`);
  }
}

export async function updateUserPresenceHeartbeat(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const dirRef = doc(db, 'userDirectory', user.uid);
  try {
    await updateDoc(dirRef, {
      displayName: getDisplayNameForUser(user),
      lastSeen: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    await syncVerifiedUserProfileAndDirectory(user);
  }
}

export function subscribeFriendPresence(
  friendUids: string[],
  onUpdate: (presenceMap: Record<string, number>) => void
): () => void {
  const uniqueUids = Array.from(new Set(friendUids.filter((id) => VALID_ID_REGEX.test(id)))).slice(0, 30);
  if (uniqueUids.length === 0) {
    onUpdate({});
    return () => {};
  }

  const presenceMap: Record<string, number> = {};
  const unsubs = uniqueUids.map((uid) =>
    onSnapshot(
      doc(db, 'userDirectory', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserDirectoryEntry;
          presenceMap[uid] = typeof data.lastSeen === 'number' ? data.lastSeen : 0;
        } else {
          presenceMap[uid] = 0;
        }
        onUpdate({ ...presenceMap });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `userDirectory/${uid}`);
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function getOrCreateMyFriendInvite(user: User): Promise<FriendInviteDoc> {
  const ownerName = getDisplayNameForUser(user);
  const invitesCol = collection(db, 'friendInvites');

  try {
    const q = query(invitesCol, where('ownerUid', '==', user.uid), where('status', '==', 'open'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const existing = snap.docs[0].data() as FriendInviteDoc;
      if (existing.ownerName !== ownerName) {
        await updateDoc(doc(db, 'friendInvites', existing.inviteToken), {
          ownerName,
          updatedAt: serverTimestamp(),
        });
        return { ...existing, ownerName };
      }
      return existing;
    }

    const token = generateSecureToken('inv');
    const inviteDoc: FriendInviteDoc = {
      inviteToken: token,
      ownerUid: user.uid,
      ownerName,
      status: 'open',
    };
    await setDoc(doc(db, 'friendInvites', token), {
      ...inviteDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return inviteDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'friendInvites');
  }
}

export async function regenerateMyFriendInvite(user: User): Promise<FriendInviteDoc> {
  const ownerName = getDisplayNameForUser(user);
  const invitesCol = collection(db, 'friendInvites');

  try {
    const q = query(invitesCol, where('ownerUid', '==', user.uid), where('status', '==', 'open'));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        status: 'revoked',
        updatedAt: serverTimestamp(),
      });
    });

    const newToken = generateSecureToken('inv');
    const newInvite: FriendInviteDoc = {
      inviteToken: newToken,
      ownerUid: user.uid,
      ownerName,
      status: 'open',
    };
    batch.set(doc(db, 'friendInvites', newToken), {
      ...newInvite,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return newInvite;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'friendInvites');
  }
}

export async function fetchFriendInviteDetails(inviteToken: string): Promise<FriendInviteDoc | null> {
  const cleanToken = extractInviteTokenFromInput(inviteToken);
  if (!cleanToken || cleanToken.length > 64 || !VALID_ID_REGEX.test(cleanToken)) {
    return null;
  }
  try {
    const snap = await getDoc(doc(db, 'friendInvites', cleanToken));
    if (!snap.exists()) return null;
    const data = snap.data() as FriendInviteDoc;
    if (data.status !== 'open') return null;
    return data;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `friendInvites/${cleanToken}`);
  }
}

export async function sendConsentFriendRequest(
  user: User,
  invite: FriendInviteDoc
): Promise<'sent' | 'already_accepted' | 'already_pending'> {
  if (!user.emailVerified) {
    throw new Error('Email verification required');
  }
  const myUid = user.uid;
  const targetUid = invite.ownerUid;
  if (myUid === targetUid) {
    throw new Error('Cannot invite yourself');
  }

  const myFriendDocRef = doc(db, 'users', myUid, 'friends', targetUid);
  try {
    const existingFriend = await getDoc(myFriendDocRef);
    if (existingFriend.exists()) {
      return 'already_accepted';
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${myUid}/friends/${targetUid}`);
  }

  const forwardId = `${myUid}_${targetUid}`;
  const reverseId = `${targetUid}_${myUid}`;
  const forwardRef = doc(db, 'friendRequests', forwardId);
  const reverseRef = doc(db, 'friendRequests', reverseId);

  try {
    const [forwardSnap, reverseSnap] = await Promise.all([getDoc(forwardRef), getDoc(reverseRef)]);

    if (reverseSnap.exists()) {
      const revData = reverseSnap.data() as FriendRequestDoc;
      if (revData.status === 'pending') {
        await approveIncomingFriendRequest(user, revData);
        return 'already_accepted';
      }
      if (revData.status === 'accepted') {
        await setDoc(myFriendDocRef, {
          friendUid: targetUid,
          friendName: sanitizeDisplayName(invite.ownerName),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return 'already_accepted';
      }
    }

    if (forwardSnap.exists()) {
      const fwdData = forwardSnap.data() as FriendRequestDoc;
      if (fwdData.status === 'pending') {
        return 'already_pending';
      }
      if (fwdData.status === 'accepted') {
        await setDoc(myFriendDocRef, {
          friendUid: targetUid,
          friendName: sanitizeDisplayName(invite.ownerName),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return 'already_accepted';
      }
      // If previously declined, delete stale doc so fresh consent request can be created cleanly
      await deleteDoc(forwardRef);
    }

    await setDoc(forwardRef, {
      requestId: forwardId,
      fromUid: myUid,
      fromName: getDisplayNameForUser(user),
      toUid: targetUid,
      toName: sanitizeDisplayName(invite.ownerName),
      inviteToken: invite.inviteToken,
      status: 'pending',
      syncedBySender: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return 'sent';
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `friendRequests/${forwardId}`);
  }
}

export async function approveIncomingFriendRequest(user: User, req: FriendRequestDoc): Promise<void> {
  if (!user.emailVerified) {
    throw new Error('Email verification required');
  }
  const reqRef = doc(db, 'friendRequests', req.requestId);
  const friendRef = doc(db, 'users', user.uid, 'friends', req.fromUid);

  try {
    const existingFriend = await getDoc(friendRef);
    const batch = writeBatch(db);
    batch.update(reqRef, {
      status: 'accepted',
      syncedBySender: false,
      updatedAt: serverTimestamp(),
    });
    if (existingFriend.exists()) {
      batch.update(friendRef, {
        friendName: sanitizeDisplayName(req.fromName),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(friendRef, {
        friendUid: req.fromUid,
        friendName: sanitizeDisplayName(req.fromName),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `friendRequests/${req.requestId}`);
  }
}

export async function declineIncomingFriendRequest(req: FriendRequestDoc): Promise<void> {
  const reqRef = doc(db, 'friendRequests', req.requestId);
  try {
    await updateDoc(reqRef, {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `friendRequests/${req.requestId}`);
  }
}

export async function syncAcceptedOutgoingRequest(user: User, req: FriendRequestDoc): Promise<void> {
  if (!user.emailVerified) return;
  const reqRef = doc(db, 'friendRequests', req.requestId);
  const friendRef = doc(db, 'users', user.uid, 'friends', req.toUid);

  try {
    const existingFriend = await getDoc(friendRef);
    const batch = writeBatch(db);
    if (existingFriend.exists()) {
      batch.update(friendRef, {
        friendName: sanitizeDisplayName(req.toName),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(friendRef, {
        friendUid: req.toUid,
        friendName: sanitizeDisplayName(req.toName),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    batch.update(reqRef, {
      syncedBySender: true,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `friendRequests/${req.requestId}`);
  }
}

export async function removeFriendWithCleanup(user: User, friendUid: string): Promise<void> {
  const friendRef = doc(db, 'users', user.uid, 'friends', friendUid);
  try {
    await deleteDoc(friendRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/friends/${friendUid}`);
  }

  // Also clean up mutual request records so either user can re-invite later cleanly
  for (const reqId of [`${user.uid}_${friendUid}`, `${friendUid}_${user.uid}`]) {
    try {
      const reqSnap = await getDoc(doc(db, 'friendRequests', reqId));
      if (reqSnap.exists()) {
        await deleteDoc(doc(db, 'friendRequests', reqId));
      }
    } catch {
      // Non-fatal if already deleted or inaccessible
    }
  }
}

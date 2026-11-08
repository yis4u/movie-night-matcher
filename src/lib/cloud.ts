import { initializeApp, getApps } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import { firebaseConfig, isEmulator } from "./config";
import { normalizeRoomCode, validateRoomCode } from "./matching";
import type { Backend, Filters } from "./service";
import type { Availability, Catalog, Identity, Room, Vote } from "./types";
const app = getApps()[0] || initializeApp(firebaseConfig);
if (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY)
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY,
    ),
    isTokenAutoRefreshEnabled: true,
  });
const auth = getAuth(app),
  db = getFirestore(app),
  functions = getFunctions(
    app,
    import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1",
  );
if (isEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
async function call<T>(name: string, data: unknown) {
  const result = await httpsCallable<unknown, T>(functions, name)(data);
  return result.data;
}
function identity(): Identity {
  const user = auth.currentUser!;
  return {
    uid: user.uid,
    name:
      user.displayName || localStorage.getItem("mnm:name") || "Movie friend",
    anonymous: user.isAnonymous,
  };
}
let authPromise: Promise<void> | undefined;
export async function initializeCloud(): Promise<Backend> {
  if (!authPromise)
    authPromise = (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) await signInAnonymously(auth);
    })();
  try {
    await authPromise;
  } catch (error) {
    authPromise = undefined;
    throw error;
  }
  return {
    identity: identity(),
    createRoom: async (user, title, country, movies) =>
      (
        await call<{ id: string }>("createRoom", {
          name: user.name,
          title,
          country,
          movies,
        })
      ).id,
    joinRoom: async (user, input) => {
      if (!validateRoomCode(input))
        throw new Error("Enter the 8-character room code from your invite.");
      return (
        await call<{ id: string }>("joinRoom", {
          id: normalizeRoomCode(input),
          name: user.name,
        })
      ).id;
    },
    vote: async (uid, code, movieId, choice) => {
      await setDoc(doc(db, "rooms", code, "votes", `${uid}_${movieId}`), {
        uid,
        movieId,
        choice,
        updatedAt: serverTimestamp(),
      });
    },
    closeRoom: async (_uid, code) => {
      await updateDoc(doc(db, "rooms", code), {
        status: "closed",
        closedAt: serverTimestamp(),
      });
    },
    watchRoom: (code, callback, error) => {
      let room: Room | null = null,
        votes: Vote[] = [],
        cached = false,
        roomLoaded = false;
      const notify = () => {
        if (roomLoaded) callback(room, votes, cached);
      };
      const unsubscribeRoom = onSnapshot(
        doc(db, "rooms", code),
        { includeMetadataChanges: true },
        (snapshot) => {
          room = snapshot.exists()
            ? ({ ...snapshot.data(), id: snapshot.id } as Room)
            : null;
          cached = snapshot.metadata.fromCache;
          roomLoaded = true;
          notify();
        },
        error,
      );
      const unsubscribeVotes = onSnapshot(
        collection(db, "rooms", code, "votes"),
        (snapshot) => {
          votes = snapshot.docs.map((d) => d.data() as Vote);
          notify();
        },
        error,
      );
      return () => {
        unsubscribeRoom();
        unsubscribeVotes();
      };
    },
    watchRooms: (uid, callback, error) =>
      onSnapshot(
        query(
          collection(db, "rooms"),
          where("memberIds", "array-contains", uid),
        ),
        (snapshot) =>
          callback(
            snapshot.docs
              .map((d) => ({ ...d.data(), id: d.id }) as Room)
              .sort((a, b) => b.createdAt - a.createdAt),
          ),
        error,
      ),
    googleSignIn: async () => {
      if (auth.currentUser?.isAnonymous) {
        try {
          await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
        } catch (error) {
          if (
            (error as { code?: string }).code ===
            "auth/credential-already-in-use"
          )
            await signInWithPopup(auth, new GoogleAuthProvider());
          else throw error;
        }
      } else await signInWithPopup(auth, new GoogleAuthProvider());
      return identity();
    },
  };
}
export async function fetchCatalog(filters: Filters) {
  await initializeCloud();
  return call<Catalog>("movieCatalog", filters);
}
export async function fetchAvailability(id: number, country: string) {
  await initializeCloud();
  return call<Availability>("watchProviders", { id, country });
}

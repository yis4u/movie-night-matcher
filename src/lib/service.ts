import { catalogConfigured, cloudConfigured } from "./config";
import { DEMO_MOVIES } from "../data/movies";
import * as demo from "./demo";
import { filterMovies } from "./discovery";
import type {
  Availability,
  Catalog,
  Identity,
  Movie,
  Room,
  Vote,
  VoteChoice,
} from "./types";
export interface Backend {
  identity: Identity;
  createRoom(
    user: Identity,
    title: string,
    country: string,
    movies: Movie[],
  ): Promise<string>;
  joinRoom(user: Identity, code: string): Promise<string>;
  vote(
    uid: string,
    code: string,
    movieId: number,
    choice: VoteChoice,
  ): Promise<void>;
  closeRoom(uid: string, code: string): Promise<void>;
  watchRoom(
    code: string,
    callback: (room: Room | null, votes: Vote[], cached: boolean) => void,
    error: (error: Error) => void,
  ): () => void;
  watchRooms(
    uid: string,
    callback: (rooms: Room[]) => void,
    error: (error: Error) => void,
  ): () => void;
  googleSignIn?(): Promise<Identity>;
}
let backendPromise: Promise<Backend> | undefined;
export function getBackend(): Promise<Backend> {
  if (backendPromise) return backendPromise;
  backendPromise = cloudConfigured
    ? import("./cloud").then((m) => m.initializeCloud())
    : Promise.resolve({
        identity: demo.demoIdentity(),
        createRoom: async (...args) => demo.createDemoRoom(...args),
        joinRoom: async (...args) => demo.joinDemoRoom(...args),
        vote: async (...args) => demo.voteDemoRoom(...args),
        closeRoom: async (...args) => demo.closeDemoRoom(...args),
        watchRoom: (code, callback, error) => {
          const update = () => {
            try {
              const { room, votes } = demo.demoRoom(code);
              callback(room, votes, false);
            } catch (e) {
              error(e as Error);
            }
          };
          update();
          window.addEventListener("storage", update);
          window.addEventListener(demo.DEMO_EVENT, update);
          return () => {
            window.removeEventListener("storage", update);
            window.removeEventListener(demo.DEMO_EVENT, update);
          };
        },
        watchRooms: (uid, callback, error) => {
          const update = () => {
            try {
              callback(demo.demoRooms(uid));
            } catch (e) {
              error(e as Error);
            }
          };
          update();
          window.addEventListener("storage", update);
          window.addEventListener(demo.DEMO_EVENT, update);
          return () => {
            window.removeEventListener("storage", update);
            window.removeEventListener(demo.DEMO_EVENT, update);
          };
        },
      });
  backendPromise.catch(() => {
    backendPromise = undefined;
  });
  return backendPromise;
}
export interface Filters {
  query: string;
  genre: string;
  sort: string;
  maxRuntime: number;
  country: string;
  page: number;
}
export async function getCatalog(filters: Filters): Promise<Catalog> {
  if (catalogConfigured) return (await import("./cloud")).fetchCatalog(filters);
  const movies = filterMovies(DEMO_MOVIES, filters);
  return { movies, hasMore: false };
}
export async function getAvailability(
  id: number,
  country: string,
): Promise<Availability | null> {
  if (!catalogConfigured) return null;
  return (await import("./cloud")).fetchAvailability(id, country);
}
export function friendlyError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const code = e?.code || "";
  if (code.includes("permission-denied"))
    return "Access denied. Rejoin the room or check the Firebase access rules.";
  if (code.includes("unauthenticated"))
    return "Your session expired. Refresh to reconnect, then try again.";
  if (code.includes("unavailable") || code.includes("network-request-failed"))
    return "We couldn’t connect. Check your internet connection and try again.";
  if (code.includes("resource-exhausted"))
    return "You’re making requests quickly. Wait a minute and try again.";
  if (code.includes("not-found"))
    return "That room doesn’t exist. Check the invite code with your friend.";
  if (code.includes("auth/"))
    return "Sign-in couldn’t finish. Check that this domain and sign-in provider are enabled in Firebase, then try again.";
  return (
    e?.message?.replace(/^Firebase: /, "").slice(0, 220) ||
    "Something went wrong. Please try again."
  );
}

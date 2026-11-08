import { randomInt } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineBoolean, defineSecret } from "firebase-functions/params";
initializeApp();
const db = getFirestore();
const tmdbToken = defineSecret("TMDB_READ_TOKEN");
const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: true });
const options = {
  region: "us-central1",
  maxInstances: 5,
  enforceAppCheck,
  cors: [
    /^https:\/\/yis4u\.github\.io$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ],
};
const COUNTRY_CODES = new Set([
  "US",
  "GB",
  "CA",
  "AU",
  "SG",
  "IN",
  "DE",
  "FR",
  "JP",
  "KR",
]);
const GENRES = {
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  18: "Drama",
  9648: "Mystery",
  878: "Science Fiction",
  53: "Thriller",
  28: "Action",
  14: "Fantasy",
  10749: "Romance",
  27: "Horror",
  10751: "Family",
  36: "History",
  99: "Documentary",
  10402: "Music",
  10752: "War",
  37: "Western",
};
function requireUser(request) {
  if (!request.auth)
    throw new HttpsError(
      "unauthenticated",
      "Sign in before using movie rooms.",
    );
  return request.auth.uid;
}
function text(value, label, max = 60) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new HttpsError("invalid-argument", `Enter a valid ${label}.`);
  return value.trim();
}
function country(value) {
  if (!COUNTRY_CODES.has(value))
    throw new HttpsError("invalid-argument", "Choose a supported country.");
  return value;
}
async function limit(uid, scope, max = 30) {
  const ref = db.collection("_rateLimits").doc(`${uid}_${scope}`),
    now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref),
      previous = snapshot.data();
    const fresh = !previous || now - previous.start > 60_000;
    if (!fresh && previous.count >= max)
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Try again in a minute.",
      );
    transaction.set(ref, {
      start: fresh ? now : previous.start,
      count: fresh ? 1 : previous.count + 1,
    });
  });
}
function movieSnapshot(value) {
  if (
    !value ||
    !Number.isInteger(value.id) ||
    value.id < 1 ||
    value.id > 99999999
  )
    throw new HttpsError("invalid-argument", "Invalid movie selection.");
  return {
    id: value.id,
    title: text(value.title, "movie title", 200),
    year: Number.isInteger(value.year) ? value.year : 0,
    rating:
      typeof value.rating === "number" && Number.isFinite(value.rating)
        ? Math.max(0, Math.min(10, value.rating))
        : 0,
    genres: Array.isArray(value.genres)
      ? value.genres
          .slice(0, 5)
          .filter((g) => typeof g === "string" && g.length < 40)
      : [],
    runtime:
      Number.isInteger(value.runtime) &&
      value.runtime > 0 &&
      value.runtime < 1000
        ? value.runtime
        : null,
    overview:
      typeof value.overview === "string" ? value.overview.slice(0, 2000) : "",
    poster:
      typeof value.poster === "string" &&
      /^\/[a-zA-Z0-9]+\.(jpg|png)$/.test(value.poster)
        ? value.poster
        : null,
    art: [
      "dune",
      "spiderverse",
      "interstellar",
      "knives",
      "budapest",
      "everything",
      "arrival",
      "soul",
      "batman",
      "pastlives",
      "martian",
      "paddington",
    ].includes(value.art)
      ? value.art
      : "interstellar",
  };
}
export const createRoom = onCall(options, async (request) => {
  const uid = requireUser(request);
  await limit(uid, "create", 5);
  const data = request.data || {},
    name = text(data.name, "name", 30),
    title = text(data.title, "room name"),
    region = country(data.country);
  if (
    title.length < 2 ||
    !Array.isArray(data.movies) ||
    data.movies.length < 1 ||
    data.movies.length > 20
  )
    throw new HttpsError(
      "invalid-argument",
      "Choose between 1 and 20 films and a room name.",
    );
  const movies = data.movies.map(movieSnapshot);
  if (new Set(movies.map((m) => m.id)).size !== movies.length)
    throw new HttpsError("invalid-argument", "Remove duplicate films.");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = Array.from(
        { length: 8 },
        () => alphabet[randomInt(alphabet.length)],
      ).join(""),
      now = Date.now();
    try {
      await db
        .collection("rooms")
        .doc(id)
        .create({
          title,
          ownerId: uid,
          memberIds: [uid],
          members: { [uid]: { name, joinedAt: now } },
          movies,
          movieIds: movies.map((m) => m.id),
          country: region,
          status: "active",
          createdAt: now,
        });
      return { id };
    } catch (error) {
      if (error.code !== 6)
        throw new HttpsError(
          "internal",
          "The room couldn’t be created. Try again.",
        );
    }
  }
  throw new HttpsError("internal", "The room couldn’t be created. Try again.");
});
export const joinRoom = onCall(options, async (request) => {
  const uid = requireUser(request);
  await limit(uid, "join", 10);
  const id = text(request.data?.id, "room code", 8).toUpperCase(),
    name = text(request.data?.name, "name", 30);
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(id))
    throw new HttpsError(
      "invalid-argument",
      "Enter the 8-character room code.",
    );
  await db.runTransaction(async (transaction) => {
    const ref = db.collection("rooms").doc(id),
      snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Room not found.");
    const room = snapshot.data();
    if (room.memberIds.includes(uid)) return;
    if (room.status !== "active")
      throw new HttpsError("failed-precondition", "This room has ended.");
    if (room.memberIds.length >= 12)
      throw new HttpsError(
        "failed-precondition",
        "This room is full (12 friends maximum).",
      );
    // The callable is the only way to add membership. Clients cannot read a room before joining.
    transaction.update(ref, {
      memberIds: FieldValue.arrayUnion(uid),
      [`members.${uid}`]: { name, joinedAt: Date.now() },
    });
  });
  return { id };
});
const cache = new Map();
async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  const key = url.toString(),
    cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.data;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tmdbToken.value()}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new HttpsError(
      "unavailable",
      "Movie data is temporarily unavailable. Try again.",
    );
  }
  if (!response.ok)
    throw new HttpsError(
      "unavailable",
      response.status === 429
        ? "Movie requests are busy. Try again shortly."
        : "Movie data is temporarily unavailable. Check the backend TMDB configuration.",
    );
  const result = await response.json();
  if (cache.size > 200) cache.clear();
  cache.set(key, { data: result, expiry: Date.now() + 300_000 });
  return result;
}
export const movieCatalog = onCall(
  { ...options, secrets: [tmdbToken] },
  async (request) => {
    const uid = requireUser(request);
    await limit(uid, "catalog", 30);
    const data = request.data || {},
      region = country(data.country),
      page = Math.min(
        20,
        Math.max(1, Number.isInteger(data.page) ? data.page : 1),
      ),
      maxRuntime = [120, 150, 180, 1000].includes(data.maxRuntime)
        ? data.maxRuntime
        : 1000;
    const genreEntry = Object.entries(GENRES).find(
        ([, name]) => name === data.genre,
      ),
      search =
        typeof data.query === "string" ? data.query.trim().slice(0, 100) : "";
    const sort =
      {
        popular: "popularity.desc",
        rating: "vote_average.desc",
        newest: "primary_release_date.desc",
      }[data.sort] || "popularity.desc";
    const result = await tmdb(
      search ? "search/movie" : "discover/movie",
      search
        ? { query: search, page, include_adult: false, region }
        : {
            page,
            include_adult: false,
            region,
            watch_region: region,
            sort_by: sort,
            "vote_count.gte": 200,
            "primary_release_date.lte": new Date().toISOString().slice(0, 10),
            "with_runtime.lte": maxRuntime,
            ...(genreEntry ? { with_genres: genreEntry[0] } : {}),
          },
    );
    let results = (result.results || []).filter((m) => !m.adult);
    // TMDB search does not support genre/runtime filters. Apply them server-side for consistent behavior.
    if (search && genreEntry)
      results = results.filter((m) =>
        (m.genre_ids || []).includes(Number(genreEntry[0])),
      );
    const movies = await Promise.all(
      results.slice(0, 20).map(async (m) => {
        let runtime = null;
        if (search && maxRuntime < 1000) {
          const details = await tmdb(`movie/${m.id}`);
          runtime = details.runtime || null;
        }
        return {
          id: m.id,
          title: m.title,
          year: Number((m.release_date || "").slice(0, 4)) || 0,
          rating: Math.round((m.vote_average || 0) * 10) / 10,
          genres: (m.genre_ids || []).map((id) => GENRES[id]).filter(Boolean),
          runtime,
          overview: m.overview || "",
          poster: m.poster_path || null,
          art: "interstellar",
        };
      }),
    );
    if (search && data.sort === "rating")
      movies.sort((a, b) => b.rating - a.rating);
    if (search && data.sort === "newest")
      movies.sort((a, b) => b.year - a.year);
    return {
      movies: movies.filter((m) => !m.runtime || m.runtime <= maxRuntime),
      hasMore: page < Math.min(result.total_pages || 1, 20),
    };
  },
);
export const watchProviders = onCall(
  { ...options, secrets: [tmdbToken] },
  async (request) => {
    const uid = requireUser(request);
    await limit(uid, "providers", 20);
    const data = request.data || {},
      region = country(data.country);
    if (!Number.isInteger(data.id) || data.id < 1 || data.id > 99999999)
      throw new HttpsError("invalid-argument", "Invalid movie.");
    const result = await tmdb(`movie/${data.id}/watch/providers`),
      offers = result.results?.[region] || {};
    const clean = (list) =>
      (list || []).map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logo: p.logo_path || null,
      }));
    const link =
      typeof offers.link === "string" &&
      offers.link.startsWith("https://www.themoviedb.org/")
        ? offers.link
        : null;
    return {
      stream: clean(offers.flatrate),
      rent: clean(offers.rent),
      buy: clean(offers.buy),
      link,
    };
  },
);

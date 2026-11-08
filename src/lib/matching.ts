import type { Room, Vote } from "./types";
export function sharedMatches(room: Room, votes: Vote[]) {
  if (room.memberIds.length < 2) return [];
  return room.movies.filter((movie) =>
    room.memberIds.every((uid) =>
      votes.some(
        (vote) =>
          vote.uid === uid &&
          vote.movieId === movie.id &&
          vote.choice === "yes",
      ),
    ),
  );
}
export function votedIds(uid: string, votes: Vote[]) {
  return new Set(
    votes.filter((vote) => vote.uid === uid).map((vote) => vote.movieId),
  );
}
export function normalizeRoomCode(input: string) {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}
export function validateRoomCode(input: string) {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(normalizeRoomCode(input));
}
export function formatRuntime(minutes: number | null) {
  return minutes
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : "Runtime unavailable";
}

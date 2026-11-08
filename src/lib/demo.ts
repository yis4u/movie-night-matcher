import type { Identity, Movie, Room, Vote, VoteChoice } from "./types";
import { normalizeRoomCode, validateRoomCode } from "./matching";
const KEY = "mnm:demo:v1";
export const DEMO_EVENT = "mnm:rooms-changed";
interface Store {
  rooms: Record<string, Room>;
  votes: Record<string, Vote[]>;
}
function read(): Store {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    return data?.rooms && data?.votes ? data : { rooms: {}, votes: {} };
  } catch {
    return { rooms: {}, votes: {} };
  }
}
function write(data: Store) {
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(DEMO_EVENT));
}
export function demoIdentity(): Identity {
  let uid = sessionStorage.getItem("mnm:uid");
  if (!uid) {
    uid = crypto.randomUUID();
    sessionStorage.setItem("mnm:uid", uid);
  }
  return {
    uid,
    name: localStorage.getItem("mnm:name") || "Movie friend",
    anonymous: true,
  };
}
export function demoRooms(uid: string) {
  return Object.values(read().rooms)
    .filter((r) => r.memberIds.includes(uid))
    .sort((a, b) => b.createdAt - a.createdAt);
}
export function demoRoom(code: string) {
  const data = read();
  return { room: data.rooms[code] || null, votes: data.votes[code] || [] };
}
export function createDemoRoom(
  user: Identity,
  title: string,
  country: string,
  movies: Movie[],
) {
  const data = read();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id: string;
  do {
    id = Array.from(
      crypto.getRandomValues(new Uint8Array(8)),
      (n) => chars[n % chars.length],
    ).join("");
  } while (data.rooms[id]);
  data.rooms[id] = {
    id,
    title,
    ownerId: user.uid,
    memberIds: [user.uid],
    members: { [user.uid]: { name: user.name, joinedAt: Date.now() } },
    country,
    status: "active",
    createdAt: Date.now(),
    movies: movies.slice(0, 20),
  };
  data.votes[id] = [];
  write(data);
  return id;
}
export function joinDemoRoom(user: Identity, input: string) {
  const id = normalizeRoomCode(input);
  if (!validateRoomCode(id))
    throw new Error("Enter the 8-character room code from your invite.");
  const data = read(),
    room = data.rooms[id];
  if (!room)
    throw new Error(
      "Room not found in this browser. Demo invites only work in tabs on the same browser.",
    );
  if (!room.memberIds.includes(user.uid)) {
    if (room.status === "closed")
      throw new Error(
        "This room has ended. Ask your friend to start a new one.",
      );
    if (room.memberIds.length >= 12)
      throw new Error("This room is full (12 friends maximum).");
    room.memberIds.push(user.uid);
    room.members[user.uid] = { name: user.name, joinedAt: Date.now() };
    write(data);
  }
  return id;
}
export function voteDemoRoom(
  uid: string,
  code: string,
  movieId: number,
  choice: VoteChoice,
) {
  const data = read(),
    room = data.rooms[code];
  if (!room?.memberIds.includes(uid))
    throw new Error("Join this room before voting.");
  if (room.status !== "active") throw new Error("This room has ended.");
  if (!room.movies.some((m) => m.id === movieId))
    throw new Error("This movie is not in the room.");
  data.votes[code] = [
    ...(data.votes[code] || []).filter(
      (v) => !(v.uid === uid && v.movieId === movieId),
    ),
    { uid, movieId, choice },
  ];
  write(data);
}
export function addDemoFriend(uid: string, code: string) {
  const data = read(),
    room = data.rooms[code];
  if (room?.ownerId !== uid || room.status !== "active")
    throw new Error("Only the host can add a demo friend to an active room.");
  const friend = "simulated-alex";
  if (room.memberIds.includes(friend)) return;
  if (room.memberIds.length >= 12) throw new Error("This room is full.");
  room.memberIds.push(friend);
  room.members[friend] = {
    name: "Alex (demo)",
    joinedAt: Date.now(),
    simulated: true,
  };
  data.votes[code] = [
    ...(data.votes[code] || []),
    ...room.movies.map((m, i) => ({
      uid: friend,
      movieId: m.id,
      choice: (i % 3 !== 2 ? "yes" : "no") as VoteChoice,
    })),
  ];
  write(data);
}
export function closeDemoRoom(uid: string, code: string) {
  const data = read();
  if (data.rooms[code]?.ownerId !== uid)
    throw new Error("Only the host can end a room.");
  data.rooms[code].status = "closed";
  write(data);
}

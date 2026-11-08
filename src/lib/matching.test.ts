import { describe, expect, it } from "vitest";
import { sharedMatches, validateRoomCode, normalizeRoomCode } from "./matching";
import { DEMO_MOVIES } from "../data/movies";
import type { Room, Vote } from "./types";
const room: Room = {
  id: "ABCDEFGH",
  title: "Film club",
  ownerId: "a",
  memberIds: ["a", "b", "c"],
  members: {},
  movies: DEMO_MOVIES.slice(0, 2),
  country: "US",
  status: "active",
  createdAt: 0,
};
const yes = (uid: string, movieId = 693134): Vote => ({
  uid,
  movieId,
  choice: "yes",
});
describe("unanimous matching", () => {
  it("needs at least two members and every current member’s explicit yes", () => {
    expect(sharedMatches({ ...room, memberIds: ["a"] }, [yes("a")])).toEqual(
      [],
    );
    expect(sharedMatches(room, [yes("a"), yes("b")])).toEqual([]);
    expect(
      sharedMatches(room, [yes("a"), yes("b"), yes("c")]).map((m) => m.id),
    ).toEqual([693134]);
  });
  it("does not treat a majority, pass, or nonmember’s yes as a match", () => {
    expect(
      sharedMatches(room, [
        yes("a"),
        yes("b"),
        { ...yes("c"), choice: "no" },
        yes("outsider"),
      ]),
    ).toEqual([]);
  });
  it("recomputes matches when membership grows", () => {
    const votes = [yes("a"), yes("b")];
    expect(
      sharedMatches({ ...room, memberIds: ["a", "b"] }, votes),
    ).toHaveLength(1);
    expect(sharedMatches(room, votes)).toHaveLength(0);
  });
});
describe("invite codes", () => {
  it("normalizes share formatting and rejects ambiguous or invalid codes", () => {
    expect(normalizeRoomCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(validateRoomCode("abcd-efgh")).toBe(true);
    for (const code of ["123", "IIIIIIII", "00000000", "<script>", "ABCDEFGHI"])
      expect(validateRoomCode(code)).toBe(false);
  });
});

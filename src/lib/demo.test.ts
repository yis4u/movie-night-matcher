import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDemoFriend,
  closeDemoRoom,
  createDemoRoom,
  demoRoom,
  joinDemoRoom,
  voteDemoRoom,
} from "./demo";
import { sharedMatches } from "./matching";
import { DEMO_MOVIES } from "../data/movies";
const host = { uid: "host", name: "Tay", anonymous: true },
  friend = { uid: "friend", name: "Maya", anonymous: true };
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) || null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
  vi.stubGlobal("window", new EventTarget());
});
describe("local demo rooms", () => {
  it("supports create, second-person join, unanimous match, and changing a vote", () => {
    const code = createDemoRoom(host, "Friday films", "US", DEMO_MOVIES);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    joinDemoRoom(friend, code);
    voteDemoRoom(host.uid, code, 693134, "yes");
    let state = demoRoom(code);
    expect(sharedMatches(state.room!, state.votes)).toHaveLength(0);
    voteDemoRoom(friend.uid, code, 693134, "yes");
    state = demoRoom(code);
    expect(sharedMatches(state.room!, state.votes)).toHaveLength(1);
    voteDemoRoom(host.uid, code, 693134, "no");
    state = demoRoom(code);
    expect(sharedMatches(state.room!, state.votes)).toHaveLength(0);
    expect(state.votes).toHaveLength(2);
  });
  it("rejects unauthorized votes and closed-room joins/votes", () => {
    const code = createDemoRoom(host, "Film club", "GB", DEMO_MOVIES);
    expect(() => voteDemoRoom(friend.uid, code, 693134, "yes")).toThrow("Join");
    expect(() => closeDemoRoom(friend.uid, code)).toThrow("host");
    closeDemoRoom(host.uid, code);
    expect(() => joinDemoRoom(friend, code)).toThrow("ended");
    expect(() => voteDemoRoom(host.uid, code, 693134, "yes")).toThrow("ended");
  });
  it("only adds explicitly simulated votes on request", () => {
    const code = createDemoRoom(host, "Film club", "US", DEMO_MOVIES);
    expect(demoRoom(code).votes).toEqual([]);
    addDemoFriend(host.uid, code);
    expect(demoRoom(code).room!.members["simulated-alex"].simulated).toBe(true);
    addDemoFriend(host.uid, code);
    expect(demoRoom(code).room!.memberIds).toHaveLength(2);
    expect(demoRoom(code).votes).toHaveLength(12);
  });
});

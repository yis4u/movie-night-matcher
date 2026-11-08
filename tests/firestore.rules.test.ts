import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
let env: RulesTestEnvironment;
const room = {
  title: "Friday films",
  ownerId: "host",
  memberIds: ["host", "friend"],
  members: { host: { name: "Host" }, friend: { name: "Friend" } },
  movieIds: [693134],
  movies: [],
  country: "US",
  status: "active",
  createdAt: 1,
};
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-movie-night",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "rooms", "ABCDEFGH"), room);
  });
});
afterAll(async () => {
  await env?.cleanup();
});
const client = (uid: string) => env.authenticatedContext(uid).firestore();
const vote = (uid = "host", choice = "yes", movieId = 693134) => ({
  uid,
  choice,
  movieId,
  updatedAt: serverTimestamp(),
});
describe("private Firebase room rules", () => {
  it("allows members to read their room and query only their memberships", async () => {
    await assertSucceeds(getDoc(doc(client("host"), "rooms", "ABCDEFGH")));
    await assertSucceeds(
      getDocs(
        query(
          collection(client("host"), "rooms"),
          where("memberIds", "array-contains", "host"),
        ),
      ),
    );
    await assertFails(getDocs(collection(client("host"), "rooms")));
    await assertFails(getDoc(doc(client("outsider"), "rooms", "ABCDEFGH")));
    await assertFails(
      getDoc(
        doc(env.unauthenticatedContext().firestore(), "rooms", "ABCDEFGH"),
      ),
    );
  });
  it("blocks clients from creating rooms, adding members, or modifying a deck", async () => {
    await assertFails(setDoc(doc(client("host"), "rooms", "NEWWROOM"), room));
    await assertFails(
      updateDoc(doc(client("host"), "rooms", "ABCDEFGH"), {
        memberIds: ["host", "friend", "outsider"],
      }),
    );
    await assertFails(
      updateDoc(doc(client("host"), "rooms", "ABCDEFGH"), { movieIds: [1] }),
    );
  });
  it("allows a member to cast and change only their own valid votes", async () => {
    const db = client("host");
    await assertSucceeds(
      setDoc(doc(db, "rooms", "ABCDEFGH", "votes", "host_693134"), vote()),
    );
    await assertSucceeds(
      setDoc(
        doc(db, "rooms", "ABCDEFGH", "votes", "host_693134"),
        vote("host", "no"),
      ),
    );
    await assertSucceeds(
      getDocs(collection(client("friend"), "rooms", "ABCDEFGH", "votes")),
    );
    await assertFails(
      setDoc(
        doc(client("friend"), "rooms", "ABCDEFGH", "votes", "host_693134"),
        vote(),
      ),
    );
    await assertFails(
      getDocs(collection(client("outsider"), "rooms", "ABCDEFGH", "votes")),
    );
  });
  it("blocks forged identity, malformed choice, wrong document id, extra fields, and unknown movies", async () => {
    const db = client("host");
    await assertFails(
      setDoc(
        doc(db, "rooms", "ABCDEFGH", "votes", "friend_693134"),
        vote("friend"),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "rooms", "ABCDEFGH", "votes", "host_693134"),
        vote("host", "maybe"),
      ),
    );
    await assertFails(
      setDoc(doc(db, "rooms", "ABCDEFGH", "votes", "wrong"), vote()),
    );
    await assertFails(
      setDoc(doc(db, "rooms", "ABCDEFGH", "votes", "host_693134"), {
        ...vote(),
        admin: true,
      }),
    );
    await assertFails(
      setDoc(
        doc(db, "rooms", "ABCDEFGH", "votes", "host_99"),
        vote("host", "yes", 99),
      ),
    );
  });
  it("lets only the host end a room and prevents votes or reopening afterward", async () => {
    await assertFails(
      updateDoc(doc(client("friend"), "rooms", "ABCDEFGH"), {
        status: "closed",
        closedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(client("host"), "rooms", "ABCDEFGH"), {
        status: "closed",
        closedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(
        doc(client("host"), "rooms", "ABCDEFGH", "votes", "host_693134"),
        vote(),
      ),
    );
    await assertFails(
      updateDoc(doc(client("host"), "rooms", "ABCDEFGH"), { status: "active" }),
    );
  });
  it("denies client access to rate-limit and arbitrary server documents", async () => {
    await assertFails(
      setDoc(doc(client("host"), "_rateLimits", "host_create"), { count: 0 }),
    );
    await assertFails(
      getDoc(doc(client("host"), "_rateLimits", "host_create")),
    );
    await assertFails(
      setDoc(doc(client("host"), "admin", "config"), { admin: true }),
    );
  });
});

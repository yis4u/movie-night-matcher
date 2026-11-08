import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  Heart,
  Info,
  Link2,
  LoaderCircle,
  Radio,
  Star,
  Users,
  X,
} from "lucide-react";
import { cloudConfigured } from "../lib/config";
import { addDemoFriend } from "../lib/demo";
import { formatRuntime, sharedMatches, votedIds } from "../lib/matching";
import { friendlyError, type Backend } from "../lib/service";
import {
  COUNTRIES,
  type Identity,
  type Movie,
  type Room,
  type Vote,
  type VoteChoice,
} from "../lib/types";
import { MovieCard, Poster } from "./Movies";
import { Modal } from "./Modal";
export function RoomView({
  code,
  user,
  backend,
  onBack,
  onDetails,
  notify,
}: {
  code: string;
  user: Identity;
  backend: Backend;
  onBack: () => void;
  onDetails: (m: Movie) => void;
  notify: (s: string) => void;
}) {
  const [room, setRoom] = useState<Room | null>(null),
    [votes, setVotes] = useState<Vote[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cached, setCached] = useState(false),
    [tab, setTab] = useState<"vote" | "matches">("vote"),
    [review, setReview] = useState<number | null>(null),
    [retry, setRetry] = useState(0),
    [ending, setEnding] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null),
    previousMatches = useRef<Set<number> | null>(null),
    voteLock = useRef(false);
  useEffect(() => {
    setLoading(true);
    setError("");
    return backend.watchRoom(
      code,
      (next, v, c) => {
        setRoom(next);
        setVotes(v);
        setCached(c);
        setLoading(false);
      },
      (e) => {
        setError(friendlyError(e));
        setLoading(false);
      },
    );
  }, [code, backend, retry]);
  const mine = votedIds(user.uid, votes),
    matches = room ? sharedMatches(room, votes) : [];
  useEffect(() => {
    const current = new Set(matches.map((m) => m.id));
    if (
      previousMatches.current &&
      [...current].some((id) => !previousMatches.current!.has(id))
    )
      notify("It’s a match! Your whole room said yes.");
    previousMatches.current = current;
  }, [matches.map((m) => m.id).join(","), notify]);
  if (loading)
    return (
      <div className="page-state" role="status">
        <span className="spinner" />
        <h2>Finding your crew…</h2>
      </div>
    );
  if (error)
    return (
      <div className="page-state">
        <Info size={30} />
        <h2>Let’s reconnect.</h2>
        <p role="alert">{error}</p>
        <button
          className="button primary"
          onClick={() => setRetry((n) => n + 1)}
        >
          Try again
        </button>
        <button className="text-button" onClick={onBack}>
          Back to discovery
        </button>
      </div>
    );
  if (!room)
    return (
      <div className="page-state">
        <Users size={32} />
        <h2>This room isn’t here.</h2>
        <p>Check the room code and ask your friend for a fresh invite.</p>
        <button className="button primary" onClick={onBack}>
          Back to discovery
        </button>
      </div>
    );
  const movie = review
    ? room.movies.find((m) => m.id === review)
    : room.movies.find((m) => !mine.has(m.id));
  const country =
      COUNTRIES.find((c) => c.code === room.country)?.name || room.country,
    simulated = room.memberIds.some((id) => room.members[id]?.simulated);
  async function vote(choice: VoteChoice) {
    if (!movie || !room || busy || voteLock.current || room.status === "closed")
      return;
    voteLock.current = true;
    setBusy(true);
    try {
      await backend.vote(user.uid, code, movie.id, choice);
      setReview(null);
      notify(
        choice === "yes"
          ? `Yes to ${movie.title}.`
          : `Passed on ${movie.title}.`,
      );
    } catch (e) {
      notify(friendlyError(e));
    } finally {
      setBusy(false);
      voteLock.current = false;
    }
  }
  async function copy(invite: boolean) {
    const text = invite
      ? `${location.origin}${import.meta.env.BASE_URL}#room=${code}`
      : code;
    try {
      await navigator.clipboard.writeText(text);
      notify(invite ? "Invite link copied." : "Room code copied.");
    } catch {
      notify(`Room code: ${code}. Copy it from the room panel.`);
    }
  }
  async function closeRoom() {
    setBusy(true);
    try {
      await backend.closeRoom(user.uid, code);
      setEnding(false);
      notify("Room ended. Your matches are saved.");
    } catch (e) {
      notify(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="room-page shell">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to discovery
      </button>
      <div className="room-heading">
        <div>
          <span className="eyebrow">THE GROUP CHAT HAS GOOD TASTE</span>
          <h1>{room.title}</h1>
          <p>
            {room.movies.length} films<span className="dot">·</span>
            {country}
            <span className="dot">·</span>
            {room.status === "closed"
              ? "Room ended"
              : "Find something everyone loves"}
          </p>
        </div>
        <span className={`connection-pill ${cached ? "muted" : ""}`}>
          <Radio size={14} />
          {!cloudConfigured
            ? "Local demo"
            : cached
              ? "Reconnecting…"
              : "Live room"}
        </span>
      </div>
      {!cloudConfigured && (
        <div className="room-demo">
          <Info size={16} />
          <span>
            Local demo — only tabs on this browser can join.
            {simulated
              ? " Alex is a simulated friend with sample votes."
              : " Add a demo friend to try matching, or open the invite in another tab."}
          </span>
        </div>
      )}
      <div className="room-layout">
        <div className="voting-panel">
          <div
            className="room-tabs"
            role="tablist"
            aria-label="Room view"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "vote"
                  : event.key === "End"
                    ? "matches"
                    : tab === "vote"
                      ? "matches"
                      : "vote";
              setTab(next);
              document.getElementById(`room-tab-${next}`)?.focus();
            }}
          >
            <button
              id="room-tab-vote"
              role="tab"
              tabIndex={tab === "vote" ? 0 : -1}
              aria-controls={tab === "vote" ? "room-vote-panel" : undefined}
              aria-selected={tab === "vote"}
              onClick={() => setTab("vote")}
            >
              The voting room
            </button>
            <button
              id="room-tab-matches"
              role="tab"
              tabIndex={tab === "matches" ? 0 : -1}
              aria-controls={tab === "matches" ? "room-matches-panel" : undefined}
              aria-selected={tab === "matches"}
              onClick={() => setTab("matches")}
            >
              <Heart size={15} />
              Shared matches <span>{matches.length}</span>
            </button>
          </div>
          {tab === "matches" ? (
            <section
              id="room-matches-panel"
              className="room-matches"
              role="tabpanel"
              aria-label="Shared matches"
            >
              {matches.length ? (
                <>
                  <div className="match-intro">
                    <CheckCheck size={25} />
                    <h2>Everybody’s kind of movie.</h2>
                    <p>
                      Every friend in the room said yes. Now grab the popcorn.
                    </p>
                  </div>
                  <div className="movie-grid room-movie-grid">
                    {matches.map((m) => (
                      <MovieCard
                        movie={m}
                        key={m.id}
                        onDetails={onDetails}
                        matched
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Heart size={34} />
                  <h2>Your next shared yes is out there.</h2>
                  <p>
                    {room.memberIds.length < 2
                      ? "Invite a friend to unlock shared matches. You need at least two people."
                      : "Keep voting. A film lands here when everyone in the room says yes."}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => setTab("vote")}
                  >
                    Back to voting
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section
              id="room-vote-panel"
              role="tabpanel"
              aria-label="The voting room"
            >
              <div className="voting-progress">
                <span>
                  Your picks
                  <strong>
                    {mine.size} / {room.movies.length}
                  </strong>
                </span>
                <progress
                  max={room.movies.length}
                  value={mine.size}
                  aria-label="Movies voted on"
                />
              </div>
              {room.status === "closed" ? (
                <div className="empty-state">
                  <CheckCheck size={36} />
                  <h2>That’s a wrap.</h2>
                  <p>
                    This room has ended. Your votes and shared matches are still
                    here.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setTab("matches")}
                  >
                    See shared matches
                    <ArrowRight size={17} />
                  </button>
                </div>
              ) : movie ? (
                <>
                  <div
                    className="vote-card"
                    tabIndex={0}
                    aria-label={`Vote on ${movie.title}. Press right arrow for yes, left arrow to pass.`}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        void vote("yes");
                      }
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        void vote("no");
                      }
                    }}
                    onTouchStart={(e) => {
                      swipe.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY,
                      };
                    }}
                    onTouchEnd={(e) => {
                      if (!swipe.current) return;
                      const dx = e.changedTouches[0].clientX - swipe.current.x,
                        dy = e.changedTouches[0].clientY - swipe.current.y;
                      swipe.current = null;
                      if (Math.abs(dx) > 70 && Math.abs(dy) < 90)
                        void vote(dx > 0 ? "yes" : "no");
                    }}
                  >
                    <div className="vote-poster">
                      <Poster movie={movie} />
                    </div>
                    <div className="vote-copy">
                      <span className="eyebrow">
                        {review ? "CHANGE YOUR MIND?" : "HOW ABOUT THIS ONE?"}
                      </span>
                      <h2>{movie.title}</h2>
                      <div className="detail-meta">
                        <span className="text-lime">
                          <Star size={14} fill="currentColor" />{" "}
                          {movie.rating.toFixed(1)}
                        </span>
                        <span>{movie.year}</span>
                        <span>{formatRuntime(movie.runtime)}</span>
                      </div>
                      <div className="genre-tags">
                        {movie.genres.map((g) => (
                          <span key={g}>{g}</span>
                        ))}
                      </div>
                      <p>{movie.overview}</p>
                      <button
                        className="text-button"
                        onClick={() => onDetails(movie)}
                      >
                        Details & where to watch
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="vote-actions">
                    <button
                      className="button vote-no"
                      onClick={() => void vote("no")}
                      disabled={busy}
                    >
                      <X size={22} />
                      Pass for now<span>←</span>
                    </button>
                    <button
                      className="button primary vote-yes"
                      onClick={() => void vote("yes")}
                      disabled={busy}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={20} />
                      ) : (
                        <Heart size={21} />
                      )}
                      I’m in!<span>→</span>
                    </button>
                  </div>
                  <p className="keyboard-note">
                    Swipe a film, use the buttons, or focus the card and use ← /
                    →.
                  </p>
                </>
              ) : (
                <div className="empty-state">
                  <div className="completed-icon">
                    <Check size={35} />
                  </div>
                  <h2>You’ve done the picking.</h2>
                  <p>
                    {room.memberIds.length < 2
                      ? "Invite a friend to see where your tastes meet."
                      : "Your picks are in. Shared matches update as your friends vote."}
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setTab("matches")}
                  >
                    See our matches
                    <Heart size={17} />
                  </button>
                </div>
              )}
              {mine.size > 0 && (
                <details className="review-votes">
                  <summary>
                    Review your votes <span>{mine.size}</span>
                  </summary>
                  <div>
                    {room.movies
                      .filter((m) => mine.has(m.id))
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setReview(m.id);
                            setTab("vote");
                          }}
                          disabled={room.status === "closed"}
                        >
                          <span>{m.title}</span>
                          <span
                            className={
                              votes.find(
                                (v) => v.uid === user.uid && v.movieId === m.id,
                              )?.choice === "yes"
                                ? "text-lime"
                                : "text-muted"
                            }
                          >
                            {votes.find(
                              (v) => v.uid === user.uid && v.movieId === m.id,
                            )?.choice === "yes"
                              ? "Yes ♥"
                              : "Pass"}
                          </span>
                        </button>
                      ))}
                  </div>
                </details>
              )}
            </section>
          )}
        </div>
        <aside className="room-sidebar">
          <div className="room-invite">
            <span className="eyebrow">YOUR ROOM, YOUR PEOPLE</span>
            <h3>Bring the whole crew.</h3>
            <p>Share your code. Find your film.</p>
            <button
              className="room-code"
              onClick={() => void copy(false)}
              aria-label={`Copy room code ${code}`}
            >
              <span>{code}</span>
              <Copy size={16} />
            </button>
            <button
              className="button secondary full-width"
              onClick={() => void copy(true)}
            >
              <Link2 size={17} />
              Copy invite link
            </button>
          </div>
          <div className="room-members">
            <h3>
              <Users size={17} />
              The crew<span>{room.memberIds.length}/12</span>
            </h3>
            {room.memberIds.map((id, i) => (
              <div className="member" key={id}>
                <span className={`avatar avatar-${i % 4}`}>
                  {(room.members[id]?.name || "?").slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>
                    {room.members[id]?.name || "Friend"}
                    {id === user.uid ? " (you)" : ""}
                  </strong>
                  <span>
                    {id === room.ownerId ? "Host" : "Movie friend"}
                    {room.members[id]?.simulated ? " · simulated" : ""}
                  </span>
                </div>
                <span className="member-progress">
                  {votes.filter((v) => v.uid === id).length}/
                  {room.movies.length}
                </span>
              </div>
            ))}
            {!cloudConfigured &&
              room.ownerId === user.uid &&
              !simulated &&
              room.status === "active" && (
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      addDemoFriend(user.uid, code);
                      notify("Alex joined with simulated votes.");
                    } catch (e) {
                      notify(friendlyError(e));
                    }
                  }}
                >
                  + Add a demo friend
                </button>
              )}
          </div>
          <div className="match-tip">
            <Heart size={20} />
            <h3>Good taste is better shared.</h3>
            <p>
              A match happens when every person says yes to the same film. No
              majority rules, no awkward compromises.
            </p>
          </div>
          {room.ownerId === user.uid && room.status === "active" && (
            <button
              className="text-button end-room"
              onClick={() => setEnding(true)}
            >
              End this movie room
            </button>
          )}
        </aside>
      </div>
      {ending && (
        <Modal
          title="Call it a movie night?"
          onClose={() => {
            if (!busy) setEnding(false);
          }}
        >
          <p className="modal-intro">
            Ending the room stops new votes and invites. Everyone can still view
            the final matches.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setEnding(false)}
            >
              Keep voting
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void closeRoom()}
            >
              {busy ? "Ending…" : "End room"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

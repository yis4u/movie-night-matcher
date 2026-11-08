import { useState, type FormEvent } from "react";
import { ArrowRight, Globe2, Info, LoaderCircle, Ticket } from "lucide-react";
import { Modal } from "./Modal";
import { Poster } from "./Movies";
import { cloudConfigured } from "../lib/config";
import { friendlyError, type Backend } from "../lib/service";
import { normalizeRoomCode } from "../lib/matching";
import { COUNTRIES, type Identity, type Movie } from "../lib/types";
export function RoomForm({
  kind,
  code = "",
  movies,
  country,
  user,
  backend,
  onCountry,
  onClose,
  onSuccess,
  onIdentity,
}: {
  kind: "create" | "join";
  code?: string;
  movies: Movie[];
  country: string;
  user: Identity;
  backend: Backend | null;
  onCountry: (value: string) => void;
  onClose: () => void;
  onSuccess: (id: string) => void;
  onIdentity: (user: Identity) => void;
}) {
  const [name, setName] = useState(
      user.name === "Movie friend" ? "" : user.name,
    ),
    [title, setTitle] = useState("Friday night crew"),
    [roomCode, setCode] = useState(code),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!backend) return;
    if (!name.trim()) {
      setError("Tell your crew what to call you.");
      return;
    }
    if (kind === "create" && title.trim().length < 2) {
      setError("Give your room a name with at least two characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const identity = { ...user, name: name.trim() };
      const id =
        kind === "create"
          ? await backend.createRoom(identity, title.trim(), country, movies)
          : await backend.joinRoom(identity, roomCode);
      localStorage.setItem("mnm:name", identity.name);
      onIdentity(identity);
      onSuccess(id);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        kind === "create"
          ? "Good company starts here."
          : "Your crew is waiting."
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-intro">
        {kind === "create"
          ? "Pick a name, send the invite, and let the good films find you."
          : "Bring your taste. Leave the endless group chat behind."}
      </p>
      {kind === "create" && movies.length > 0 && (
        <div className="deck-preview">
          <div className="deck-preview-posters">
            {movies.slice(0, 5).map((movie) => (
              <Poster movie={movie} key={movie.id} />
            ))}
          </div>
          <div>
            <span className="eyebrow">YOUR OPENING LINEUP</span>
            <strong>
              {Math.min(movies.length, 20)} films. One shared favorite.
            </strong>
            <p>Everyone votes on these same picks.</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="room-form">
        <label>
          Your name
          <input
            autoComplete="nickname"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should your friends call you?"
            minLength={1}
            maxLength={30}
            required
            disabled={busy}
          />
        </label>
        {kind === "create" ? (
          <>
            <label>
              Room name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={2}
                maxLength={60}
                required
                disabled={busy}
              />
            </label>
            <label>
              <span>
                <Globe2 size={14} /> Streaming country
              </span>
              <select
                value={country}
                onChange={(e) => onCountry(e.target.value)}
                disabled={busy}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-note">
              <Ticket size={19} />
              <span>
                <strong>
                  {Math.min(movies.length, 20)} films in your room
                </strong>
                <br />
                This lineup is saved with your room.
              </span>
            </div>
            {movies.length === 0 && (
              <p className="error-box">
                No films selected. Change your discovery filters before creating
                a room.
              </p>
            )}
          </>
        ) : (
          <label>
            Invite code
            <input
              className="code-input"
              value={roomCode}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              placeholder="e.g. H7K9P2NX"
              autoComplete="off"
              maxLength={8}
              minLength={8}
              required
              disabled={busy}
            />
          </label>
        )}
        {!cloudConfigured && (
          <div className="demo-note">
            <Info size={17} />
            <span>
              Local demo: invites work in tabs on this browser. Rooms are stored
              on this device and aren’t private.
            </span>
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button
          className="button primary full-width"
          disabled={busy || !backend || (kind === "create" && !movies.length)}
        >
          {busy ? (
            <>
              <LoaderCircle className="spin" size={18} />
              Getting your room ready…
            </>
          ) : (
            <>
              {kind === "create" ? "Create movie room" : "Join the room"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}

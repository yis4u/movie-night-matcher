import type { CSSProperties } from "react";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { Modal } from "./Modal";
import { Poster } from "./Movies";
import type { Movie, Room } from "../lib/types";
export function MatchReveal({
  movie,
  room,
  onClose,
  onMatches,
  onDetails,
}: {
  movie: Movie;
  room: Room;
  onClose: () => void;
  onMatches: () => void;
  onDetails: () => void;
}) {
  const simulated = room.memberIds.some((id) => room.members[id]?.simulated);
  return (
    <Modal title="It’s a match!" onClose={onClose}>
      <div className="match-reveal">
        <div className="reveal-confetti" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  "--confetti-x": `${(i * 37) % 100}%`,
                  "--confetti-delay": `${i * 0.045}s`,
                  "--confetti-turn": `${i * 41}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <span className="reveal-badge">
          <Heart size={17} fill="currentColor" />A SHARED YES
        </span>
        <div className="reveal-poster">
          <Poster movie={movie} />
          <span>
            <Sparkles size={21} />
          </span>
        </div>
        <h3>{movie.title}</h3>
        <p>
          All {room.memberIds.length} friends said yes.
          <br />
          Looks like you’ve found your movie.
        </p>
        <div className="reveal-crew" aria-label="Friends who matched">
          {room.memberIds.map((id, i) => (
            <span
              key={id}
              className={`avatar avatar-${i % 4}`}
              title={room.members[id]?.name}
            >
              {room.members[id]?.name?.[0]?.toUpperCase() || "?"}
            </span>
          ))}
        </div>
        {simulated && (
          <p className="reveal-demo">Includes Alex’s simulated demo vote.</p>
        )}
        <button className="button primary full-width" onClick={onMatches}>
          See shared matches
          <ArrowRight size={17} />
        </button>
        <button className="text-button" onClick={onDetails}>
          Where can we watch it?
          <ArrowRight size={15} />
        </button>
      </div>
    </Modal>
  );
}

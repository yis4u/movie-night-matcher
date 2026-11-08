import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  CirclePlay,
  Globe2,
  Info,
  Plus,
  Star,
} from "lucide-react";
import { Modal } from "./Modal";
import { catalogConfigured } from "../lib/config";
import { friendlyError, getAvailability } from "../lib/service";
import { COUNTRIES, type Availability, type Movie } from "../lib/types";
import { formatRuntime } from "../lib/matching";
export function Poster({
  movie,
  className = "",
}: {
  movie: Movie;
  className?: string;
}) {
  const fallback = `${import.meta.env.BASE_URL}art/${movie.art || "interstellar"}.svg`;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [movie.id]);
  return (
    <img
      className={`poster ${className}`}
      src={
        movie.poster && !failed
          ? `https://image.tmdb.org/t/p/w500${movie.poster}`
          : fallback
      }
      onError={() => setFailed(true)}
      alt={`${movie.title}${failed || !movie.poster ? " · illustrated poster" : " poster"}`}
      loading="lazy"
      width="500"
      height="750"
    />
  );
}
export function MovieCard({
  movie,
  onDetails,
  onCreate,
  matched = false,
  saved = false,
  selected = false,
  onSave,
  onSelect,
}: {
  movie: Movie;
  onDetails: (movie: Movie) => void;
  onCreate?: (movie: Movie) => void;
  matched?: boolean;
  saved?: boolean;
  selected?: boolean;
  onSave?: (movie: Movie) => void;
  onSelect?: (movie: Movie) => void;
}) {
  return (
    <article className={`movie-card ${selected ? "movie-selected" : ""}`}>
      <div className="poster-wrap">
        <button
          className="poster-open"
          onClick={() => onDetails(movie)}
          aria-label={`Details and streaming for ${movie.title}`}
        >
          <Poster movie={movie} />
          <span className="poster-hover">
            <CirclePlay size={32} />
            <span>Take a closer look</span>
          </span>
        </button>
        <span className="rating">
          <Star size={11} fill="currentColor" />
          {movie.rating.toFixed(1)}
        </span>
        {onSave && (
          <button
            className={`save-movie ${saved ? "is-saved" : ""}`}
            aria-label={`${saved ? "Remove" : "Save"} ${movie.title} ${saved ? "from" : "to"} shortlist`}
            aria-pressed={saved}
            onClick={() => onSave(movie)}
          >
            <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
        {onSelect && (
          <button
            className={`poster-add ${selected ? "is-selected" : ""}`}
            aria-label={`${selected ? "Remove" : "Add"} ${movie.title} ${selected ? "from" : "to"} movie night`}
            aria-pressed={selected}
            onClick={() => onSelect(movie)}
          >
            {selected ? <Check size={18} /> : <Plus size={18} />}
          </button>
        )}
        {selected && (
          <span className="selected-caption">
            <Check size={12} />
            In your lineup
          </span>
        )}
        {matched ? (
          <span className="match-badge">
            <Check size={13} /> Everyone’s in
          </span>
        ) : (
          onCreate && (
            <button
              className="poster-add"
              aria-label={`Start a room with ${movie.title}`}
              onClick={() => onCreate(movie)}
            >
              <Plus size={18} />
            </button>
          )
        )}
      </div>
      <button className="movie-title" onClick={() => onDetails(movie)}>
        {movie.title}
      </button>
      <p className="movie-meta">
        {movie.year}
        <span>·</span>
        {movie.genres[0] || "Movie"}
      </p>
    </article>
  );
}
export function MovieDetails({
  movie,
  country,
  onCountry,
  onClose,
  onCreate,
}: {
  movie: Movie;
  country: string;
  onCountry: (c: string) => void;
  onClose: () => void;
  onCreate?: (m: Movie) => void;
}) {
  const [availability, setAvailability] = useState<Availability | null>(null),
    [loading, setLoading] = useState(catalogConfigured),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(catalogConfigured);
    setError("");
    setAvailability(null);
    getAvailability(movie.id, country)
      .then((data) => {
        if (active) setAvailability(data);
      })
      .catch((e) => {
        if (active) setError(friendlyError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [movie.id, country, retry]);
  const countryName =
    COUNTRIES.find((c) => c.code === country)?.name || country;
  const empty =
    availability &&
    !availability.stream.length &&
    !availability.rent.length &&
    !availability.buy.length;
  return (
    <Modal title={movie.title} onClose={onClose} wide>
      <div className="movie-detail">
        <Poster movie={movie} />
        <div className="detail-copy">
          <div className="detail-meta">
            <span className="text-lime">
              <Star size={14} fill="currentColor" /> {movie.rating.toFixed(1)}
            </span>
            <span>{movie.year}</span>
            <span>{formatRuntime(movie.runtime)}</span>
          </div>
          <div className="genre-tags">
            {movie.genres.map((g) => (
              <span key={g}>{g}</span>
            ))}
          </div>
          <p className="overview">
            {movie.overview || "No synopsis is available for this film yet."}
          </p>
          {onCreate && (
            <button className="button primary" onClick={() => onCreate(movie)}>
              Start a room with this film
              <ArrowUpRight size={17} />
            </button>
          )}
        </div>
      </div>
      <div className="availability-head">
        <h3>Make it a movie night.</h3>
        <label className="country-field">
          <Globe2 size={15} />
          <span className="sr-only">Streaming country</span>
          <select
            aria-label="Streaming country"
            value={country}
            onChange={(e) => onCountry(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <div className="availability-state" role="status">
          <span className="spinner" />
          Checking streaming options in {countryName}…
        </div>
      ) : error ? (
        <div className="error-box" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      ) : !availability ? (
        <div className="availability-state">
          <Info size={21} />
          <div>
            <strong>Streaming lookup is in demo mode.</strong>
            <p>
              Connect the TMDB backend to check real availability by country. No
              streaming offers are simulated.
            </p>
          </div>
        </div>
      ) : empty ? (
        <div className="availability-state">
          <Globe2 size={23} />
          <div>
            <strong>No offers listed in {countryName}.</strong>
            <p>
              Try another country or check back later. This doesn’t necessarily
              mean the film is unavailable.
            </p>
          </div>
        </div>
      ) : (
        <div className="provider-groups">
          {(
            [
              { key: "stream", label: "Included with subscription" },
              { key: "rent", label: "Rent" },
              { key: "buy", label: "Buy" },
            ] as const
          ).map(
            (group) =>
              availability[group.key].length > 0 && (
                <div key={group.key}>
                  <h4>{group.label}</h4>
                  <div className="providers">
                    {availability[group.key].map((p) => (
                      <span className="provider" key={p.id}>
                        {p.logo && (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${p.logo}`}
                            alt=""
                            width="26"
                            height="26"
                          />
                        )}
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      )}
      {availability?.link && (
        <a
          className="button secondary full-width"
          target="_blank"
          rel="noreferrer"
          href={availability.link}
        >
          See offers on TMDB <ArrowUpRight size={16} />
        </a>
      )}
      <p className="fine-print">
        Availability data from TMDB, powered by JustWatch. Offers and
        subscriptions can change.
      </p>
    </Modal>
  );
}

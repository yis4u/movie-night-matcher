import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Heart,
  Moon,
  Orbit,
  Plus,
  Shuffle,
  Smile,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { DEMO_MOVIES } from "../data/movies";
import { Poster } from "./Movies";
import { formatRuntime } from "../lib/matching";
import type { Movie } from "../lib/types";
const SPOTLIGHTS = [
  DEMO_MOVIES[0],
  DEMO_MOVIES[1],
  DEMO_MOVIES[4],
  DEMO_MOVIES[6],
];
export function DiscoveryHero({
  onCreate,
  onJoin,
  onDetails,
  onSurprise,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onDetails: (movie: Movie) => void;
  onSurprise: () => void;
}) {
  const [index, setIndex] = useState(0),
    movie = SPOTLIGHTS[index];
  return (
    <section className="cinema-hero shell" aria-label="Your next movie night">
      <div className="cinema-scene" aria-hidden="true" />
      <div className="cinema-vignette" aria-hidden="true" />
      <div className="cinema-topline">
        <span className="cinema-edition">
          <span className="status-dot" />
          THE MOVIE NIGHT CLUB
        </span>
        <span className="cinema-coordinate">GOOD COMPANY. GREAT CINEMA.</span>
      </div>
      <div className="cinema-copy">
        <span className="hero-kicker">
          THE BEST PLANS START WITH A SHARED YES
        </span>
        <h1>
          Less debating.
          <br />
          <span>
            More movie
            <br className="hero-line-break" /> nights.
          </span>
        </h1>
        <p>
          A little adventure. A lot of good company.
          <br />
          Find the film your whole crew wants to watch.
        </p>
        <div className="hero-actions">
          <button className="button primary" onClick={onCreate}>
            <Plus size={18} />
            Create a room
            <ArrowUpRight size={18} />
          </button>
          <button className="button glass" onClick={onJoin}>
            Join with a code
            <ArrowRight size={17} />
          </button>
        </div>
        <button className="surprise-button" onClick={onSurprise}>
          <Shuffle size={15} />
          Feeling spontaneous? Surprise me
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="cinema-annotation">
        <span className="annotation-line" />
        <span>
          YOUR NEXT FAVORITE
          <br />
          IS OUT THERE.
        </span>
      </div>
      <div className="hero-bottom">
        <a className="browse-link" href="#discover">
          <span>
            <ArrowDown size={18} />
          </span>
          Explore the collection
        </a>
        <div className="spotlight">
          <button
            className="spotlight-film"
            onClick={() => onDetails(movie)}
            aria-label={`Explore spotlight: ${movie.title}`}
          >
            <Poster movie={movie} />
            <div>
              <span className="eyebrow">IN THE SPOTLIGHT</span>
              <strong>{movie.title}</strong>
              <span className="spotlight-meta">
                <Star size={11} fill="currentColor" />
                {movie.rating.toFixed(1)}
                <i /> {movie.year}
                <i />
                {formatRuntime(movie.runtime)}
              </span>
            </div>
            <ArrowUpRight size={19} />
          </button>
          <div className="spotlight-controls">
            <span className="spotlight-counter">
              0{index + 1}
              <span>/ 04</span>
            </span>
            <button
              className="icon-button"
              aria-label="Previous spotlight film"
              onClick={() => setIndex((i) => (i + 3) % 4)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Next spotlight film"
              onClick={() => setIndex((i) => (i + 1) % 4)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
export const MOODS = [
  {
    id: "escape",
    title: "Out of this world",
    description: "Big ideas. Bigger adventures.",
    genre: "Science Fiction",
    runtime: 1000,
    icon: Orbit,
    color: "violet",
  },
  {
    id: "feelgood",
    title: "A little feel-good",
    description: "For the lighter side of life.",
    genre: "Comedy",
    runtime: 1000,
    icon: Smile,
    color: "peach",
  },
  {
    id: "mystery",
    title: "Keep us guessing",
    description: "One more twist. One more theory.",
    genre: "Mystery",
    runtime: 1000,
    icon: Moon,
    color: "blue",
  },
  {
    id: "quick",
    title: "In before midnight",
    description: "Great stories in under two hours.",
    genre: "All genres",
    runtime: 120,
    icon: Clapperboard,
    color: "green",
  },
];
export function MoodCollections({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="mood-section shell" aria-label="Browse by mood">
      <div className="mood-heading">
        <span className="eyebrow">SET THE SCENE</span>
        <span>What kind of night is it?</span>
      </div>
      <div className="mood-grid">
        {MOODS.map(({ id, title, description, icon: Icon, color }) => (
          <button
            className={`mood-card mood-${color}`}
            key={id}
            onClick={() => onSelect(id)}
            aria-pressed={id === active}
          >
            <span className="mood-icon">
              <Icon size={24} />
            </span>
            <span>
              <strong>{title}</strong>
              <span>{description}</span>
            </span>
            {active === id ? <Check size={17} /> : <ArrowUpRight size={17} />}
          </button>
        ))}
      </div>
    </section>
  );
}
export function HowItWorks() {
  return (
    <section className="how-strip shell" aria-label="How movie nights work">
      {[
        {
          icon: Users,
          title: "Make it a group thing",
          copy: "One room. All your movie people.",
        },
        {
          icon: Heart,
          title: "A yes, a no, a little magic",
          copy: "Vote on the films that feel like you.",
        },
        {
          icon: Sparkles,
          title: "Meet your shared favorite",
          copy: "Everyone’s in? That’s your movie.",
        },
      ].map(({ icon: Icon, title, copy }, i) => (
        <div key={title}>
          <span className="step-icon">
            <Icon size={20} />
          </span>
          <p>
            <strong>
              <span className="step-number">0{i + 1}</span>
              {title}
            </strong>
            <span>{copy}</span>
          </p>
        </div>
      ))}
    </section>
  );
}

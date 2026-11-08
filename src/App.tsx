import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Shuffle,
  ArrowUpRight,
  Check,
  Compass,
  Film,
  Globe2,
  Heart,
  Info,
  LoaderCircle,
  Plus,
  Popcorn,
  Radio,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  cloudConfigured,
  catalogConfigured,
  partialConfiguration,
} from "./lib/config";
import {
  friendlyError,
  getBackend,
  getCatalog,
  type Backend,
} from "./lib/service";
import {
  COUNTRIES,
  GENRES,
  type Identity,
  type Movie,
  type Room,
  type Vote,
} from "./lib/types";
import { sharedMatches } from "./lib/matching";
import { Modal } from "./components/Modal";
import { MovieCard, MovieDetails, Poster } from "./components/Movies";
import { RoomForm } from "./components/RoomForm";
import { RoomView } from "./components/RoomView";
import {
  DiscoveryHero,
  HowItWorks,
  MoodCollections,
  MOODS,
} from "./components/DiscoveryHero";
import { filterMovies, readShortlist } from "./lib/discovery";
import "./styles.css";
import "./experience.css";
type Page = "discover" | "rooms" | "matches";
type FormState = { kind: "create" | "join"; code?: string; movies?: Movie[] };
export default function App() {
  const [page, setPage] = useState<Page>("discover"),
    [activeRoom, setActiveRoom] = useState<string | null>(null),
    [backend, setBackend] = useState<Backend | null>(null),
    [user, setUser] = useState<Identity>({
      uid: "",
      name: "Movie friend",
      anonymous: true,
    }),
    [authError, setAuthError] = useState(""),
    [authRetry, setAuthRetry] = useState(0),
    [rooms, setRooms] = useState<Room[]>([]),
    [roomsError, setRoomsError] = useState(""),
    [roomsLoading, setRoomsLoading] = useState(true),
    [roomsRetry, setRoomsRetry] = useState(0);
  const [country, setCountry] = useState(() => {
      const saved = localStorage.getItem("mnm:country");
      return COUNTRIES.some((c) => c.code === saved) ? saved! : "US";
    }),
    [form, setForm] = useState<FormState | null>(() => {
      const code = new URLSearchParams(location.hash.slice(1)).get("room");
      return code ? { kind: "join", code } : null;
    }),
    [details, setDetails] = useState<Movie | null>(null),
    [info, setInfo] = useState(false),
    [profile, setProfile] = useState(false),
    [profileBusy, setProfileBusy] = useState(false),
    [profileError, setProfileError] = useState(""),
    [toast, setToast] = useState("");
  const [query, setQuery] = useState(""),
    [debouncedQuery, setDebouncedQuery] = useState(""),
    [genre, setGenre] = useState("All genres"),
    [sort, setSort] = useState("popular"),
    [maxRuntime, setMaxRuntime] = useState(1000),
    [catalogPage, setCatalogPage] = useState(1),
    [movies, setMovies] = useState<Movie[]>([]),
    [loading, setLoading] = useState(true),
    [catalogError, setCatalogError] = useState(""),
    [catalogRetry, setCatalogRetry] = useState(0),
    [hasMore, setHasMore] = useState(false);
  const [roomMatches, setRoomMatches] = useState<
    Record<string, { room: Room; votes: Vote[] }>
  >({});
  const [shortlist, setShortlist] = useState<Movie[]>(readShortlist);
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [selectedMovies, setSelectedMovies] = useState<Movie[]>([]);
  const [mood, setMood] = useState("");
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let active = true;
    setAuthError("");
    getBackend()
      .then((service) => {
        if (active) {
          setBackend(service);
          setUser(service.identity);
        }
      })
      .catch((e) => {
        if (active) {
          setAuthError(friendlyError(e));
          setRoomsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [authRetry]);
  useEffect(() => {
    if (!backend || !user.uid) return;
    setRoomsLoading(true);
    setRoomsError("");
    return backend.watchRooms(
      user.uid,
      (next) => {
        setRooms(next);
        setRoomsLoading(false);
      },
      (e) => {
        setRoomsError(friendlyError(e));
        setRoomsLoading(false);
      },
    );
  }, [backend, user.uid, roomsRetry]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setCatalogPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setCatalogError("");
    getCatalog({
      query: debouncedQuery,
      genre,
      sort,
      maxRuntime,
      country,
      page: catalogPage,
    })
      .then((result) => {
        if (active) {
          setMovies((previous) =>
            catalogPage === 1
              ? result.movies
              : [
                  ...previous,
                  ...result.movies.filter(
                    (m) => !previous.some((p) => p.id === m.id),
                  ),
                ],
          );
          setHasMore(result.hasMore);
        }
      })
      .catch((e) => {
        if (active) setCatalogError(friendlyError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedQuery,
    genre,
    sort,
    maxRuntime,
    country,
    catalogPage,
    catalogRetry,
  ]);
  useEffect(() => {
    const change = () => {
      const code = new URLSearchParams(location.hash.slice(1)).get("room");
      if (code && code !== activeRoom) setForm({ kind: "join", code });
      if (!code) setActiveRoom(null);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [activeRoom]);
  useEffect(() => {
    if (page !== "matches" || !backend) return;
    setRoomMatches({});
    const unsubscribes = rooms.map((room) =>
      backend.watchRoom(
        room.id,
        (next, votes) => {
          if (next)
            setRoomMatches((previous) => ({
              ...previous,
              [room.id]: { room: next, votes },
            }));
        },
        (e) => setRoomsError(friendlyError(e)),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [page, backend, rooms.map((r) => r.id).join(",")]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === "mnm:shortlist:v1") setShortlist(readShortlist());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        page === "discover" &&
        !activeRoom &&
        !document.querySelector("dialog[open]") &&
        !target.closest('input,textarea,select,[contenteditable="true"]')
      ) {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(".search-field input")
          ?.focus();
      }
    };
    window.addEventListener("keydown", search);
    return () => window.removeEventListener("keydown", search);
  }, [page, activeRoom]);
  function toggleSave(movie: Movie) {
    const exists = shortlist.some((item) => item.id === movie.id);
    if (!exists && shortlist.length >= 100) {
      notify("Your shortlist has 100 films. Remove a pick to save another.");
      return;
    }
    const next = exists
      ? shortlist.filter((item) => item.id !== movie.id)
      : [...shortlist, movie];
    try {
      localStorage.setItem("mnm:shortlist:v1", JSON.stringify(next));
      setShortlist(next);
      notify(
        exists
          ? `${movie.title} removed from your shortlist.`
          : `${movie.title} saved for another great night.`,
      );
    } catch {
      notify(
        "Your browser couldn’t save this shortlist. Allow site storage and try again.",
      );
    }
  }
  function toggleSelection(movie: Movie) {
    if (selectedMovies.some((item) => item.id === movie.id)) {
      setSelectedMovies((items) =>
        items.filter((item) => item.id !== movie.id),
      );
      return;
    }
    if (selectedMovies.length >= 20) {
      notify(
        "A movie night can have up to 20 films. Remove a pick to add another.",
      );
      return;
    }
    setSelectedMovies((items) => [...items, movie]);
  }
  function chooseMood(id: string) {
    const preset = MOODS.find((item) => item.id === id);
    if (!preset) return;
    if (mood === id) {
      setMood("");
      setGenre("All genres");
      setMaxRuntime(1000);
    } else {
      setMood(id);
      setGenre(preset.genre);
      setMaxRuntime(preset.runtime);
    }
    setQuery("");
    setCatalogPage(1);
    document
      .getElementById("discover")
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }
  function changeCountry(value: string) {
    setCountry(value);
    setCatalogPage(1);
    localStorage.setItem("mnm:country", value);
  }
  function navigate(next: Page) {
    setPage(next);
    setActiveRoom(null);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openRoom(id: string) {
    setForm(null);
    setActiveRoom(id);
    setPage("rooms");
    history.replaceState(null, "", `#room=${id}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function create(seed?: Movie) {
    setDetails(null);
    setForm({
      kind: "create",
      movies: seed
        ? [seed]
        : selectedMovies.length
          ? selectedMovies
          : undefined,
    });
  }
  function filterGenre(value: string) {
    setMood("");
    setGenre(value);
    setCatalogPage(1);
  }
  const countryLabel = COUNTRIES.find((c) => c.code === country)!;
  const visibleMovies = shortlistOnly
    ? filterMovies(shortlist, {
        query: debouncedQuery,
        genre,
        sort,
        maxRuntime,
      })
    : movies;
  const deck = form?.movies || visibleMovies;
  function surprise() {
    if (!visibleMovies.length) {
      notify("Try another filter to find your surprise pick.");
      return;
    }
    setDetails(
      visibleMovies[
        crypto.getRandomValues(new Uint32Array(1))[0] % visibleMovies.length
      ],
    );
  }
  const nav = [
    { page: "discover", label: "Discover", icon: Compass },
    { page: "rooms", label: "My rooms", icon: Users },
    { page: "matches", label: "Your matches", icon: Heart },
  ] as const;
  const allMatches = Object.values(roomMatches).flatMap(({ room, votes }) =>
    sharedMatches(room, votes).map((movie) => ({ room, movie })),
  );
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner shell">
          <button
            className="brand"
            aria-label="Movie Night Matcher home"
            onClick={() => navigate("discover")}
          >
            <span className="brand-icon">
              <Popcorn size={24} strokeWidth={2} />
            </span>
            <span>
              movie night
              <span className="brand-second">
                matcher<span className="brand-period">.</span>
              </span>
            </span>
          </button>
          <nav className="desktop-nav" aria-label="Main navigation">
            {nav.map(({ page: key, label, icon: Icon }) => (
              <button
                key={key}
                className={page === key ? "nav-active" : ""}
                aria-current={page === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                <Icon size={16} />
                {label}
                {key === "rooms" && rooms.length > 0 && (
                  <span className="nav-count">{rooms.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="header-tools">
            <label className="header-country">
              <Globe2 size={16} />
              <span className="sr-only">Country</span>
              <select
                aria-label="Country"
                value={country}
                onChange={(e) => changeCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.short}
                  </option>
                ))}
              </select>
            </label>
            <span className="header-divider" />
            <button
              className="profile-button"
              aria-label="Your profile and connection"
              onClick={() => setProfile(true)}
            >
              {user.name === "Movie friend" ? (
                <Users size={18} />
              ) : (
                user.name[0].toUpperCase()
              )}
              <span className="profile-dot" />
            </button>
          </div>
        </div>
      </header>
      <div className="connection-banner">
        <div className="shell">
          <span className="status-dot" />
          <span>
            {cloudConfigured ? (
              <>
                <strong>
                  {backend
                    ? "Connected to Firebase"
                    : authError
                      ? "Firebase connection unavailable"
                      : "Connecting to Firebase…"}
                </strong>
                <span className="banner-detail">
                  {" "}
                  ·{" "}
                  {catalogConfigured
                    ? "Live rooms & movie discovery"
                    : "Live rooms · sample movie catalog"}
                </span>
              </>
            ) : (
              <>
                <strong>
                  {partialConfiguration
                    ? "Setup incomplete · local demo"
                    : "You’re in the demo screening."}
                </strong>
                <span className="banner-detail">
                  {" "}
                  Create a room and try it out — no sign-up needed.
                </span>
              </>
            )}
          </span>
          <button onClick={() => setInfo(true)}>
            {cloudConfigured ? "How it works" : "About demo mode"}
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
      {authError && (
        <div className="shell global-error error-box" role="alert">
          {authError}
          <button
            className="text-button"
            onClick={() => setAuthRetry((n) => n + 1)}
          >
            Retry connection
          </button>
        </div>
      )}
      <div id="main-content" tabIndex={-1}>
        {activeRoom && backend ? (
          <RoomView
            key={activeRoom}
            code={activeRoom}
            user={user}
            backend={backend}
            onBack={() => navigate("discover")}
            onDetails={setDetails}
            notify={notify}
          />
        ) : page === "discover" ? (
          <main>
            <DiscoveryHero
              onCreate={() => create()}
              onJoin={() => setForm({ kind: "join" })}
              onDetails={setDetails}
              onSurprise={surprise}
            />
            <HowItWorks />
            <MoodCollections active={mood} onSelect={chooseMood} />
            <section className="discovery-section shell" id="discover">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">GOOD STORIES. GREAT COMPANY.</span>
                  <h2>
                    Find your next <span>“yes.”</span>
                  </h2>
                </div>
                <span className="catalog-badge">
                  <span className="status-dot" />
                  {catalogConfigured
                    ? "Fresh from TMDB"
                    : "The demo collection"}
                </span>
              </div>
              <div className="collection-switch">
                <div aria-label="Movie collection">
                  <button
                    aria-pressed={!shortlistOnly}
                    onClick={() => setShortlistOnly(false)}
                  >
                    <Film size={16} />
                    All films
                  </button>
                  <button
                    aria-pressed={shortlistOnly}
                    onClick={() => setShortlistOnly(true)}
                  >
                    <Bookmark size={15} />
                    My shortlist<span>{shortlist.length}</span>
                  </button>
                </div>
                <button
                  className="text-button surprise-inline"
                  onClick={surprise}
                >
                  <Shuffle size={15} />
                  Surprise me
                </button>
              </div>
              <div className="catalog-toolbar">
                <label className="search-field">
                  <Search size={19} />
                  <input
                    aria-label="Search movies"
                    placeholder="Search for your next favorite…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {!query && <kbd className="search-shortcut">/</kbd>}
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <label className="filter-select">
                  <SlidersHorizontal size={16} />
                  <span className="sr-only">Movie genre</span>
                  <select
                    aria-label="Movie genre"
                    value={genre}
                    onChange={(e) => filterGenre(e.target.value)}
                  >
                    {GENRES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label className="filter-select runtime-filter">
                  <span className="sr-only">Maximum runtime</span>
                  <select
                    aria-label="Maximum runtime"
                    value={maxRuntime}
                    onChange={(e) => {
                      setMood("");
                      setMaxRuntime(Number(e.target.value));
                      setCatalogPage(1);
                    }}
                  >
                    <option value={1000}>Any runtime</option>
                    <option value={120}>Under 2 hours</option>
                    <option value={150}>Under 2.5 hours</option>
                    <option value={180}>Under 3 hours</option>
                  </select>
                </label>
                <label className="sort-select">
                  <span>Sort by</span>
                  <select
                    aria-label="Sort movies"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setCatalogPage(1);
                    }}
                  >
                    <option value="popular">Popular</option>
                    <option value="rating">Top rated</option>
                    <option value="newest">Newest</option>
                  </select>
                </label>
              </div>
              <div className="catalog-subrow">
                <div className="genre-chips" aria-label="Quick genre filters">
                  {[
                    "All genres",
                    "Science Fiction",
                    "Comedy",
                    "Thriller",
                    "Animation",
                  ].map((g) => (
                    <button
                      key={g}
                      aria-pressed={genre === g}
                      onClick={() => filterGenre(g)}
                    >
                      {g === "All genres" ? (
                        <>
                          <Sparkles size={13} />
                          All picks
                        </>
                      ) : g === "Science Fiction" ? (
                        "Sci-fi"
                      ) : (
                        g
                      )}
                    </button>
                  ))}
                </div>
                <span className="result-count" role="status">
                  {shortlistOnly || (!loading && !catalogError)
                    ? `${visibleMovies.length} ${visibleMovies.length === 1 ? "film" : "films"}${shortlistOnly ? " in your shortlist" : " to fall for"}`
                    : loading
                      ? "Finding good films…"
                      : ""}
                </span>
              </div>
              {catalogError && !shortlistOnly ? (
                <div className="empty-state">
                  <Info size={28} />
                  <h3>The projector hit a snag.</h3>
                  <p role="alert">{catalogError}</p>
                  <button
                    className="button secondary"
                    onClick={() => setCatalogRetry((n) => n + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : loading && catalogPage === 1 && !shortlistOnly ? (
                <div
                  className="movie-grid"
                  aria-busy="true"
                  aria-label="Loading movies"
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <div className="movie-skeleton" key={i}>
                      <div />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : visibleMovies.length ? (
                <div className="movie-grid">
                  {visibleMovies.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      onDetails={setDetails}
                      onSave={toggleSave}
                      saved={shortlist.some((item) => item.id === movie.id)}
                      onSelect={toggleSelection}
                      selected={selectedMovies.some(
                        (item) => item.id === movie.id,
                      )}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Film size={32} />
                  <h3>
                    {shortlistOnly && !shortlist.length
                      ? "Save a little movie-night inspiration."
                      : "No films in this frame."}
                  </h3>
                  <p>
                    {shortlistOnly && !shortlist.length
                      ? "Tap the bookmark on a film to save it here. Your shortlist stays on this browser for the nights to come."
                      : "Try another title, genre, or runtime. Your next yes is out there."}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setQuery("");
                      filterGenre("All genres");
                      setMaxRuntime(1000);
                      if (shortlistOnly && !shortlist.length)
                        setShortlistOnly(false);
                    }}
                  >
                    {shortlistOnly && !shortlist.length
                      ? "Explore all films"
                      : "Reset filters"}
                  </button>
                </div>
              )}
              {hasMore && !catalogError && !shortlistOnly && (
                <div className="load-more">
                  <button
                    className="button secondary"
                    disabled={loading}
                    onClick={() => setCatalogPage((n) => n + 1)}
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="spin" size={17} />
                        Loading more…
                      </>
                    ) : (
                      <>
                        More films, more possibilities
                        <Plus size={16} />
                      </>
                    )}
                  </button>
                </div>
              )}
              <div className="catalog-caption">
                <span>
                  {catalogConfigured
                    ? "Movie data by TMDB."
                    : "A curated sample catalog. Posters by TMDB, with illustrated fallbacks. Ratings are sample snapshots."}
                </span>
                <span>
                  <Globe2 size={13} />
                  Streaming region: {countryLabel.name}
                </span>
              </div>
            </section>
            <section className="bottom-invite shell">
              <div className="bottom-popcorn">
                <Popcorn size={43} />
              </div>
              <div>
                <span className="eyebrow">
                  THE ONLY THING MISSING? YOUR FRIENDS.
                </span>
                <h2>Make tonight a movie night.</h2>
                <p>The snacks are on you. The deciding is on us.</p>
              </div>
              <button className="button primary" onClick={() => create()}>
                Get the crew together
                <ArrowUpRight size={18} />
              </button>
            </section>
          </main>
        ) : (
          <main className="collection-page shell">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {page === "rooms"
                    ? "GOOD FILMS NEED GOOD COMPANY"
                    : "WHERE YOUR TASTES MEET"}
                </span>
                <h1>
                  {page === "rooms"
                    ? "Your movie rooms."
                    : "Everybody’s favorites."}
                </h1>
                <p>
                  {page === "rooms"
                    ? "Pick up where your crew left off, or start something new."
                    : "The films that got a yes from everyone in the room."}
                </p>
              </div>
              <button className="button primary" onClick={() => create()}>
                <Plus size={17} />
                Create a room
              </button>
            </div>
            {roomsError ? (
              <div className="error-box" role="alert">
                {roomsError}
                <button
                  className="text-button"
                  onClick={() => setRoomsRetry((n) => n + 1)}
                >
                  Try again
                </button>
              </div>
            ) : roomsLoading ? (
              <div className="page-state" role="status">
                <span className="spinner" />
                Finding your movie nights…
              </div>
            ) : page === "rooms" ? (
              rooms.length ? (
                <div className="rooms-grid">
                  {rooms.map((room) => (
                    <button
                      className="room-tile"
                      key={room.id}
                      onClick={() => openRoom(room.id)}
                    >
                      <div className="room-tile-posters">
                        {room.movies.slice(0, 3).map((m) => (
                          <Poster key={m.id} movie={m} />
                        ))}
                      </div>
                      <div className="room-tile-copy">
                        <span className="eyebrow">
                          {room.status === "active"
                            ? "READY WHEN YOU ARE"
                            : "THAT’S A WRAP"}
                        </span>
                        <h2>{room.title}</h2>
                        <p>
                          <Users size={14} />
                          {room.memberIds.length}{" "}
                          {room.memberIds.length === 1 ? "friend" : "friends"}
                          <span>·</span>
                          {room.movies.length} films
                        </p>
                        <span className="room-tile-link">
                          Enter the room
                          <ArrowUpRight size={17} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state collection-empty">
                  <span className="empty-icon">
                    <Users size={37} />
                  </span>
                  <h2>Your crew’s next chapter starts here.</h2>
                  <p>
                    No rooms yet. Create your first movie room or join a friend
                    with an invite code.
                  </p>
                  <div className="dialog-actions">
                    <button className="button primary" onClick={() => create()}>
                      Create your first room
                      <Plus size={17} />
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setForm({ kind: "join" })}
                    >
                      Join a room
                    </button>
                  </div>
                </div>
              )
            ) : rooms.length && !Object.keys(roomMatches).length ? (
              <div className="page-state" role="status">
                <span className="spinner" />
                Finding your shared yeses…
              </div>
            ) : allMatches.length ? (
              <div className="matched-groups">
                {rooms
                  .filter((r) => allMatches.some((m) => m.room.id === r.id))
                  .map((room) => (
                    <section key={room.id}>
                      <div className="matches-heading">
                        <h2>{room.title}</h2>
                        <button
                          className="text-button"
                          onClick={() => openRoom(room.id)}
                        >
                          Open room
                          <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="movie-grid">
                        {allMatches
                          .filter((m) => m.room.id === room.id)
                          .map(({ movie }) => (
                            <MovieCard
                              key={movie.id}
                              movie={movie}
                              onDetails={setDetails}
                              matched
                            />
                          ))}
                      </div>
                    </section>
                  ))}
              </div>
            ) : (
              <div className="empty-state collection-empty">
                <span className="empty-icon">
                  <Heart size={36} />
                </span>
                <h2>The best yes is a shared yes.</h2>
                <p>
                  Join a room and vote with your friends. When every person
                  likes a film, it appears here.
                </p>
                <button
                  className="button primary"
                  onClick={() => navigate("rooms")}
                >
                  Find your movie room
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
          </main>
        )}
      </div>
      {selectedMovies.length > 0 && page === "discover" && !activeRoom && (
        <aside className="deck-dock" aria-label="Selected movie night lineup">
          <div className="dock-posters" aria-hidden="true">
            {selectedMovies.slice(0, 3).map((movie) => (
              <Poster key={movie.id} movie={movie} />
            ))}
          </div>
          <div className="dock-copy">
            <span className="eyebrow">YOUR MOVIE NIGHT IS TAKING SHAPE</span>
            <strong>
              {selectedMovies.length}{" "}
              {selectedMovies.length === 1 ? "film" : "films"} in your lineup
              <span role="status" className="sr-only">
                {selectedMovies.map((movie) => movie.title).join(", ")}
              </span>
            </strong>
          </div>
          <button className="dock-clear" onClick={() => setSelectedMovies([])}>
            Clear<span className="sr-only"> movie night selection</span>
          </button>
          <button className="button primary" onClick={() => create()}>
            Create room with {selectedMovies.length}{" "}
            {selectedMovies.length === 1 ? "film" : "films"}
            <ArrowRight size={17} />
          </button>
        </aside>
      )}
      <footer
        className="site-footer shell"
        style={
          selectedMovies.length > 0 && page === "discover" && !activeRoom
            ? { paddingBottom: "185px" }
            : undefined
        }
      >
        <div>
          <span className="footer-brand">
            <Popcorn size={18} />
            movie night matcher.
          </span>
          <span>Made for the nights you’ll talk about.</span>
        </div>
        <div className="footer-links">
          <button onClick={() => setInfo(true)}>How it works</button>
          <a
            href="https://github.com/yis4u/movie-night-matcher"
            target="_blank"
            rel="noreferrer"
          >
            Open source
            <ArrowUpRight size={12} />
          </a>
          <span className="tmdb-mark">TMDB</span>
        </div>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(({ page: key, label, icon: Icon }) => (
          <button
            key={key}
            aria-current={page === key ? "page" : undefined}
            className={page === key ? "nav-active" : ""}
            onClick={() => navigate(key)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {form && (
        <RoomForm
          {...form}
          movies={deck}
          country={country}
          user={user}
          backend={backend}
          onCountry={changeCountry}
          onClose={() => setForm(null)}
          onSuccess={openRoom}
          onIdentity={setUser}
        />
      )}
      {details && (
        <MovieDetails
          movie={details}
          country={country}
          onCountry={changeCountry}
          onClose={() => setDetails(null)}
          onCreate={!activeRoom ? create : undefined}
        />
      )}
      {info && (
        <Modal
          title="Less debating. More watching."
          onClose={() => setInfo(false)}
        >
          <div className="help-steps">
            <div>
              <span>01</span>
              <div>
                <h3>Get everyone in the same room.</h3>
                <p>
                  Create a room from your discovery picks, then share its invite
                  code with your friends.
                </p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>Give every film a yes or a pass.</h3>
                <p>
                  Swipe, use the buttons, or focus the film card and use the
                  arrow keys. You can review and change your votes.
                </p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>Let the shared yeses find you.</h3>
                <p>
                  At least two people, every person says yes: it’s a match. Open
                  a film to see where to watch in your country.
                </p>
              </div>
            </div>
          </div>
          <div className="demo-note">
            <Info size={20} />
            <div>
              <strong>
                {cloudConfigured
                  ? "Your Firebase connection"
                  : "About this demo"}
              </strong>
              <p>
                {cloudConfigured
                  ? `Rooms use Firebase authentication and realtime updates. ${catalogConfigured ? "Streaming offers come from TMDB and JustWatch." : "The movie catalog and ratings are samples; streaming lookup is not connected."}`
                  : "No account or backend is connected. Rooms and votes are saved in this browser and sync between its tabs, not across devices. Anyone using this browser can see them. “Add a demo friend” simulates Alex’s votes. Movie ratings are samples; streaming offers aren’t simulated."}
              </p>
            </div>
          </div>
          <a
            className="text-button setup-link"
            href="https://github.com/yis4u/movie-night-matcher#connect-firebase-and-tmdb"
            target="_blank"
            rel="noreferrer"
          >
            Firebase & TMDB setup guide
            <ArrowUpRight size={16} />
          </a>
        </Modal>
      )}
      {profile && (
        <Modal title="Hey, movie friend." onClose={() => setProfile(false)}>
          <div className="profile-details">
            <span className="avatar avatar-0">
              {user.name[0].toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <p>
                {cloudConfigured
                  ? user.anonymous
                    ? "Firebase guest session"
                    : "Signed in with Google"
                  : "Local demo session"}
              </p>
            </div>
          </div>
          <p className="modal-intro">
            {cloudConfigured
              ? "Guests can return on this browser. Sign in with Google before creating rooms to access them on other devices. Existing Google accounts have their own rooms."
              : "You can choose a name when you create or join a room. No account is required in demo mode."}
          </p>
          {cloudConfigured && backend?.googleSignIn && user.anonymous && (
            <button
              className="button primary full-width"
              disabled={profileBusy}
              onClick={async () => {
                setProfileBusy(true);
                setProfileError("");
                try {
                  const next = await backend.googleSignIn!();
                  setUser(next);
                  navigate("rooms");
                  setProfile(false);
                  notify("Signed in. Ready for your next movie night.");
                } catch (e) {
                  setProfileError(friendlyError(e));
                } finally {
                  setProfileBusy(false);
                }
              }}
            >
              {profileBusy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Users size={18} />
              )}
              Continue with Google
            </button>
          )}
          {profileError && (
            <div className="error-box" role="alert">
              {profileError}
            </div>
          )}
          <div className="form-note">
            <Radio size={19} />
            <span>
              {cloudConfigured
                ? "Private rooms are available only to invited members. Treat invite codes as private."
                : "This is a local demo. Connect Firebase for private shared rooms across devices."}
            </span>
          </div>
        </Modal>
      )}
      <div
        className={`toast ${toast ? "toast-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Check size={17} />
            <span>{toast}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </>
  );
}

import type { Movie } from "./types";
export function filterMovies(
  movies: Movie[],
  filters: { query: string; genre: string; sort: string; maxRuntime: number },
) {
  const result = movies.filter(
    (movie) =>
      (filters.genre === "All genres" ||
        movie.genres.includes(filters.genre)) &&
      movie.title.toLowerCase().includes(filters.query.toLowerCase().trim()) &&
      (!movie.runtime || movie.runtime <= filters.maxRuntime),
  );
  if (filters.sort === "rating") result.sort((a, b) => b.rating - a.rating);
  if (filters.sort === "newest") result.sort((a, b) => b.year - a.year);
  return result;
}
export function readShortlist(): Movie[] {
  try {
    const value = JSON.parse(localStorage.getItem("mnm:shortlist:v1") || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (movie): movie is Movie =>
          movie &&
          Number.isInteger(movie.id) &&
          typeof movie.title === "string" &&
          Array.isArray(movie.genres) &&
          movie.genres.every((g: unknown) => typeof g === "string") &&
          typeof movie.rating === "number" &&
          Number.isFinite(movie.rating) &&
          (movie.runtime === null || typeof movie.runtime === "number") &&
          typeof movie.year === "number" &&
          typeof movie.overview === "string" &&
          typeof movie.art === "string" &&
          (movie.poster === null || typeof movie.poster === "string"),
      )
      .slice(0, 100);
  } catch {
    return [];
  }
}

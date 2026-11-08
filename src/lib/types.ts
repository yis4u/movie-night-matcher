export type VoteChoice = "yes" | "no";
export type Genre =
  | "All genres"
  | "Adventure"
  | "Animation"
  | "Comedy"
  | "Crime"
  | "Drama"
  | "Mystery"
  | "Science Fiction"
  | "Thriller";
export interface Movie {
  id: number;
  title: string;
  year: number;
  rating: number;
  genres: string[];
  runtime: number | null;
  overview: string;
  poster: string | null;
  art: string;
}
export interface Member {
  name: string;
  joinedAt: number;
  simulated?: boolean;
}
export interface Room {
  id: string;
  title: string;
  ownerId: string;
  memberIds: string[];
  members: Record<string, Member>;
  movies: Movie[];
  country: string;
  status: "active" | "closed";
  createdAt: number;
}
export interface Vote {
  uid: string;
  movieId: number;
  choice: VoteChoice;
}
export interface Identity {
  uid: string;
  name: string;
  anonymous: boolean;
}
export interface Catalog {
  movies: Movie[];
  hasMore: boolean;
}
export interface Provider {
  id: number;
  name: string;
  logo: string | null;
}
export interface Availability {
  stream: Provider[];
  rent: Provider[];
  buy: Provider[];
  link: string | null;
}
export const COUNTRIES = [
  { code: "US", name: "United States", short: "US" },
  { code: "GB", name: "United Kingdom", short: "UK" },
  { code: "CA", name: "Canada", short: "CA" },
  { code: "AU", name: "Australia", short: "AU" },
  { code: "SG", name: "Singapore", short: "SG" },
  { code: "IN", name: "India", short: "IN" },
  { code: "DE", name: "Germany", short: "DE" },
  { code: "FR", name: "France", short: "FR" },
  { code: "JP", name: "Japan", short: "JP" },
  { code: "KR", name: "South Korea", short: "KR" },
];
export const GENRES: Genre[] = [
  "All genres",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Drama",
  "Mystery",
  "Science Fiction",
  "Thriller",
];

const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "",
  appId: env.VITE_FIREBASE_APP_ID || "",
};
export const isEmulator = env.DEV && env.VITE_USE_FIREBASE_EMULATORS === "true";
export const cloudConfigured =
  Object.values(firebaseConfig).every(Boolean) &&
  Boolean(env.VITE_FIREBASE_APPCHECK_SITE_KEY || isEmulator);
export const partialConfiguration =
  Object.values(firebaseConfig).some(Boolean) && !cloudConfigured;
export const catalogConfigured =
  cloudConfigured && env.VITE_TMDB_ENABLED === "true";

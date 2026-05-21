/**
 * Profile Service
 * Manages user profile data in localStorage with Firebase Auth defaults.
 */

const STORAGE_KEY = "chess_user_profile";

export interface UserProfile {
  username: string;
  avatarUrl: string | null;    // data URL (uploaded) or Google photoURL
  gamesPlayed: number;
  wins: number;
  losses: number;
  /** true once user has manually set a custom username */
  customUsername: boolean;
  /** true once user has manually uploaded a custom avatar */
  customAvatar: boolean;
}

function defaultProfile(): UserProfile {
  return {
    username: "Player",
    avatarUrl: null,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    customUsername: false,
    customAvatar: false,
  };
}

/** Load profile from localStorage, falling back to defaults. */
export function getProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultProfile(), ...parsed };
    }
  } catch {
    // corrupt data — start fresh
  }
  return defaultProfile();
}

/** Persist profile to localStorage. */
export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Sync profile with Firebase Auth user on login.
 * Uses Google displayName/photoURL only if the user hasn't set custom values.
 */
export function syncWithAuthUser(user: { displayName: string | null; photoURL: string | null }): void {
  const profile = getProfile();

  if (!profile.customUsername && user.displayName) {
    profile.username = user.displayName;
  }

  if (!profile.customAvatar && user.photoURL) {
    profile.avatarUrl = user.photoURL;
  }

  saveProfile(profile);
}

/** Update username (marks as custom). */
export function updateUsername(name: string): void {
  const profile = getProfile();
  profile.username = name.trim() || profile.username;
  profile.customUsername = true;
  saveProfile(profile);
}

/** Update avatar with a base64 data URL (marks as custom). */
export function updateAvatar(dataUrl: string): void {
  const profile = getProfile();
  profile.avatarUrl = dataUrl;
  profile.customAvatar = true;
  saveProfile(profile);
}

/** Record a finished game result. */
export function recordGameResult(outcome: "win" | "loss" | "draw"): void {
  const profile = getProfile();
  profile.gamesPlayed++;
  if (outcome === "win") profile.wins++;
  else if (outcome === "loss") profile.losses++;
  saveProfile(profile);
}

/**
 * Generate an SVG data URL with the user's initial, used as fallback
 * when no Google photo and no custom avatar exists.
 */
export function generateInitialAvatar(username: string): string {
  const letter = (username.charAt(0) || "P").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3A4458"/>
        <stop offset="100%" stop-color="#4A5A7B"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#bg)"/>
    <text x="50" y="54" text-anchor="middle" dominant-baseline="central"
          font-family="Inter, sans-serif" font-size="42" font-weight="700"
          fill="#C9A85C">${letter}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** Get the display avatar URL — custom → Google → generated fallback. */
export function getAvatarUrl(profile: UserProfile): string {
  return profile.avatarUrl || generateInitialAvatar(profile.username);
}

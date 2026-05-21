/**
 * Profile Page Renderer
 * Shows user avatar, username, stats, and allows editing.
 */

import {
  getProfile,
  updateUsername,
  updateAvatar,
  getAvatarUrl,
} from "../services/profileService";
import type { UserProfile } from "../services/profileService";

/**
 * Resize an image file to a max dimension and return a base64 data URL.
 */
function resizeImage(file: File, maxSize: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
        } else {
          if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function winRate(profile: UserProfile): string {
  if (profile.gamesPlayed === 0) return "—";
  return Math.round((profile.wins / profile.gamesPlayed) * 100) + "%";
}

/**
 * Render the profile screen into the app container.
 * @param onBack callback to return to the landing screen
 */
export function renderProfileScreen(container: HTMLElement, onBack: () => void): void {
  const profile = getProfile();
  const avatarSrc = getAvatarUrl(profile);

  container.innerHTML = `
    <div class="profile-screen">
      <div class="profile-card">
        <button id="profile-back-btn" class="btn btn-secondary btn-small profile-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Back
        </button>

        <div class="profile-header">
          <div class="profile-avatar-wrapper" id="profile-avatar-wrapper">
            <img src="${avatarSrc}" alt="Profile" class="profile-avatar-img" id="profile-avatar-img" />
            <div class="profile-avatar-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span>Change</span>
            </div>
            <input type="file" id="profile-avatar-input" accept="image/*" class="visually-hidden" />
          </div>

          <div class="profile-name-area">
            <input
              type="text"
              id="profile-username-input"
              class="profile-username-input"
              value="${escapeHtml(profile.username)}"
              maxlength="24"
              placeholder="Your name"
            />
            <span class="profile-edit-hint">Click to edit name</span>
          </div>
        </div>

        <div class="profile-stats-grid">
          <div class="stat-card">
            <span class="stat-value" id="stat-games">${profile.gamesPlayed}</span>
            <span class="stat-label">Games Played</span>
          </div>
          <div class="stat-card stat-card--win">
            <span class="stat-value" id="stat-wins">${profile.wins}</span>
            <span class="stat-label">Wins</span>
          </div>
          <div class="stat-card stat-card--loss">
            <span class="stat-value" id="stat-losses">${profile.losses}</span>
            <span class="stat-label">Losses</span>
          </div>
          <div class="stat-card stat-card--rate">
            <span class="stat-value" id="stat-winrate">${winRate(profile)}</span>
            <span class="stat-label">Win Rate</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Back button
  document.getElementById("profile-back-btn")!.onclick = onBack;

  // ── Avatar upload
  const avatarWrapper = document.getElementById("profile-avatar-wrapper")!;
  const avatarInput = document.getElementById("profile-avatar-input") as HTMLInputElement;
  const avatarImg = document.getElementById("profile-avatar-img") as HTMLImageElement;

  avatarWrapper.onclick = () => avatarInput.click();

  avatarInput.onchange = async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      updateAvatar(dataUrl);
      avatarImg.src = dataUrl;
    } catch {
      // silently fail on bad image
    }
  };

  // ── Username editing
  const usernameInput = document.getElementById("profile-username-input") as HTMLInputElement;

  function saveUsername() {
    const val = usernameInput.value.trim();
    if (val && val !== profile.username) {
      updateUsername(val);
      profile.username = val;
    } else {
      usernameInput.value = profile.username;
    }
  }

  usernameInput.onblur = saveUsername;
  usernameInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      usernameInput.blur();
    }
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

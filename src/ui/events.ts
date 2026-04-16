import { Game } from "../core/Game";
import { Board } from "../core/Board";
import type { PieceColor } from "../core/Piece";
import { renderBoard } from "./renderBoard";
import type { RenderOptions } from "./renderBoard";
import {
  createGame,
  joinGame,
  listenToGame,
  makeMove,
} from "../services/gameService";
import type { GameDocument } from "../services/gameService";

export function initChessUI(loginWithGoogle: () => Promise<any>) {
  const app = document.getElementById("app")!;

  app.innerHTML = `
    <div class="landing-screen">
      <div class="landing-card">
        <div class="hero-copy">
          <span class="hero-eyebrow">Real-time Chess</span>
          <h1>Play Online With Your Friends</h1>
          <p>Sign in, create a game, and invite a friend with a game ID.</p>
        </div>
        <div class="auth-panel">
          <button id="login" class="btn btn-primary">Login with Google</button>
          <button id="create" class="btn btn-secondary">Create Game</button>
          <div class="join-row">
            <input id="gameInput" class="input-field" placeholder="Enter Game ID" />
            <button id="join" class="btn btn-secondary btn-small">Join</button>
          </div>
        </div>
        <div id="user-area" class="user-area"></div>
      </div>
    </div>

    <div class="game-screen hidden">
      <div class="top-bar">
        <div>
          <h2>Chess Match</h2>
          <p id="game-state-text" class="game-state-text">Waiting for opponent…</p>
        </div>
        <div id="game-id-display" class="game-id-display"></div>
      </div>
      <div class="game-layout">
        <div class="board-wrapper">
          <div class="board-frame">
            <div class="rank-labels" id="rank-labels"></div>
            <div id="board"></div>
            <div class="file-labels" id="file-labels"></div>
          </div>
          <div id="status-bar" class="status-bar">
            <span id="status-text">Sign in and create or join a game to begin.</span>
          </div>
        </div>
      </div>
    </div>

    <div id="toast" class="toast"></div>
  `;

  buildLabels();

  let game = new Game();
  let currentUser: any = null;
  let currentGameId: string | null = null;
  let currentUserColor: PieceColor | null = null;
  let currentGameData: GameDocument | null = null;
  let unsubscribe: (() => void) | null = null;

  const boardEl = document.getElementById("board")!;
  const landingScreen = document.querySelector(".landing-screen")!;
  const gameScreen = document.querySelector(".game-screen")!;
  const gameStateText = document.getElementById("game-state-text")!;
  const gameIdDisplay = document.getElementById("game-id-display")!;
  const statusText = document.getElementById("status-text")!;

  function setGameScreenActive(active: boolean) {
    landingScreen.classList.toggle("hidden", active);
    gameScreen.classList.toggle("hidden", !active);
  }

  function renderCurrentUser() {
    const userArea = document.getElementById("user-area")!;
    if (currentUser) {
      userArea.innerHTML = `
        <div class="user-badge">
          <div class="user-icon">✓</div>
          <div>
            <div class="user-name">${currentUser.displayName}</div>
            <div class="user-status">Online</div>
          </div>
        </div>`;
    } else {
      userArea.innerHTML = "";
    }
  }

  function getValidMoves(): string[] {
    if (!currentGameData || !currentUserColor || !game.selectedSquare) return [];
    if (!game.isOwnPiece(game.selectedSquare)) return [];

    const moves: string[] = [];
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];

    for (const f of files) {
      for (const r of ranks) {
        const sq = f + r;
        if (game.isValidMove(game.selectedSquare, sq)) {
          moves.push(sq);
        }
      }
    }

    return moves;
  }

  function findKingInCheck(): string | null {
    const state = game.getBoardState();
    for (const sq of Object.keys(state)) {
      const p = state[sq];
      if (p && p.type === "king" && p.color === game.turn) {
        if (isKingUnderAttack(sq, game.turn)) return sq;
      }
    }
    return null;
  }

  function isKingUnderAttack(kingSq: string, kingColor: PieceColor): boolean {
    const state = game.getBoardState();
    const opponentColor = kingColor === "white" ? "black" : "white";
    for (const sq of Object.keys(state)) {
      const p = state[sq];
      if (p && p.color === opponentColor) {
        const savedTurn = game.turn;
        game.turn = opponentColor;
        const canAttack = game.isValidMove(sq, kingSq);
        game.turn = savedTurn;
        if (canAttack) return true;
      }
    }
    return false;
  }

  function updateStatusBar() {
    if (!currentGameData) {
      statusText.textContent = "Sign in and create or join a game to begin.";
      return;
    }

    if (currentGameData.status === "waiting") {
      statusText.textContent = "Waiting for an opponent…";
      return;
    }

    const isYourTurn = currentUserColor && game.turn === currentUserColor;
    statusText.textContent = isYourTurn ? "Your turn" : "Opponent's turn";
  }

  function updateTopBar() {
    if (!currentGameData || !currentGameId) {
      gameStateText.textContent = "Create or join a game to start.";
      gameIdDisplay.innerHTML = "";
      return;
    }

    gameStateText.textContent = currentGameData.status === "waiting" ? "Waiting for opponent…" : `${game.turn.charAt(0).toUpperCase() + game.turn.slice(1)} to move`;
    gameIdDisplay.innerHTML = `
      <div class="game-id-display" title="Click to copy">
        <span class="label">Game ID</span>
        <span class="id-text">${currentGameId}</span>
        <span class="copy-icon">📋</span>
      </div>`;

    const copyButton = gameIdDisplay.querySelector(".game-id-display");
    copyButton?.addEventListener("click", () => {
      navigator.clipboard.writeText(currentGameId!);
      showToast("Game ID copied");
    });
  }

  function refresh() {
    const options: RenderOptions = {
      validMoves: getValidMoves(),
      lastMove: null,
      inCheck: findKingInCheck()
    };

    renderBoard(boardEl, game.getBoardState(), game.selectedSquare, handleClick, options);
    updateStatusBar();
    updateTopBar();
  }

  async function handleClick(square: string) {
    if (!currentGameData || !currentGameId || !currentUserColor) return;
    if (game.turn !== currentUserColor) return;

    if (game.isOwnPiece(square)) {
      game.selectSquare(square);
      refresh();
      return;
    }

    if (game.selectedSquare && game.isValidMove(game.selectedSquare, square)) {
      const fromSquare = game.selectedSquare;
      if (game.move(fromSquare, square)) {
        try {
          await makeMove(currentGameId, game.getBoardState(), game.turn);
        } catch {
          showToast("Move failed. Please try again.");
        }
      }
      refresh();
      return;
    }

    game.clearSelection();
    refresh();
  }

  function showToast(message: string) {
    const toast = document.getElementById("toast")!;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  async function initializeGameListener(gameId: string) {
    if (unsubscribe) {
      unsubscribe();
    }

    unsubscribe = listenToGame(gameId, (data) => {
      if (!data) {
        showToast("Game not found.");
        return;
      }

      currentGameData = data;
      game.board = new Board(data.board);
      game.turn = data.turn;
      game.clearSelection();
      setGameScreenActive(true);
      refresh();
    });
  }

  document.getElementById("login")!.onclick = async () => {
    try {
      currentUser = await loginWithGoogle();
      renderCurrentUser();
      document.getElementById("login")!.style.display = "none";
      showToast(`Welcome, ${currentUser.displayName}!`);
    } catch {
      showToast("Login failed. Please try again.");
    }
  };

  document.getElementById("create")!.onclick = async () => {
    if (!currentUser) {
      showToast("Please sign in with Google first.");
      return;
    }

    try {
      const id = await createGame(currentUser.uid);
      currentGameId = id;
      currentUserColor = "white";
      await initializeGameListener(id);
      showToast("Game created. Share the game ID with your opponent.");
    } catch {
      showToast("Unable to create game. Please try again.");
    }
  };

  document.getElementById("join")!.onclick = async () => {
    if (!currentUser) {
      showToast("Please sign in with Google first.");
      return;
    }

    const enteredId = (document.getElementById("gameInput") as HTMLInputElement).value.trim();
    if (!enteredId) {
      showToast("Enter a game ID to join.");
      return;
    }

    try {
      await joinGame(enteredId, currentUser.uid);
      currentGameId = enteredId;
      currentUserColor = "black";
      await initializeGameListener(enteredId);
      showToast("Joined game successfully.");
    } catch (error) {
      showToast((error as Error).message || "Unable to join game.");
    }
  };

  setGameScreenActive(false);
  renderCurrentUser();
  refresh();
}

function buildLabels() {
  const rankContainer = document.getElementById("rank-labels")!;
  const fileContainer = document.getElementById("file-labels")!;

  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  rankContainer.innerHTML = ranks.map((r) => `<span>${r}</span>`).join("");
  fileContainer.innerHTML = files.map((f) => `<span>${f}</span>`).join("");
}

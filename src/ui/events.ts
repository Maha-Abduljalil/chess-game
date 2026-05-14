import { Game } from "../core/Game";
import { playSound } from "../services/audio";
import type { PieceColor } from "../core/Piece";
import { renderBoard } from "./renderBoard";
import type { RenderOptions } from "./renderBoard";
import { ChessTimer } from "../services/timerService";
import type { TimerState } from "../services/timerService";
import {
  createGame, joinGame, listenToGame, makeMove, makeTimeoutMove, getGame,
} from "../services/gameService";
import type { GameDocument, TimeControl } from "../services/gameService";

const TIME_PRESETS: { label: string; value: TimeControl }[] = [
  { label: "1 min  (Bullet)",    value: { initialMs:   60_000, incrementMs:     0 } },
  { label: "2+1    (Bullet)",    value: { initialMs:  120_000, incrementMs: 1_000 } },
  { label: "3 min  (Blitz)",     value: { initialMs:  180_000, incrementMs:     0 } },
  { label: "3+2    (Blitz)",     value: { initialMs:  180_000, incrementMs: 2_000 } },
  { label: "5 min  (Blitz)",     value: { initialMs:  300_000, incrementMs:     0 } },
  { label: "10 min (Rapid)",     value: { initialMs:  600_000, incrementMs:     0 } },
  { label: "15+10  (Rapid)",     value: { initialMs:  900_000, incrementMs:10_000 } },
  { label: "30 min (Classical)", value: { initialMs:1_800_000, incrementMs:     0 } },
];

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

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
          <div class="time-control-row">
            <label class="tc-label" for="time-control">Time Control</label>
            <select id="time-control" class="tc-select">
              ${TIME_PRESETS.map((p, i) =>
                `<option value="${i}"${i === 5 ? " selected" : ""}>${p.label}</option>`
              ).join("")}
            </select>
          </div>
          <button id="create" class="btn btn-secondary">Create Game</button>
          <div class="join-row">
            <input id="gameInput" class="input-field" placeholder="Enter Game ID" />
            <button id="join" class="btn btn-secondary btn-small">Join / Watch</button>
          </div>
        </div>
        <div id="user-area" class="user-area"></div>
      </div>
    </div>

    <div class="game-screen hidden">
      <div class="top-bar">
        <div class="title-group">
          <div class="title-header">
            <img src="/icon.png" class="app-icon" alt="App Icon">
            <h2>Chess Match</h2>
          </div>
          <p id="game-state-text" class="game-state-text">Waiting for opponent…</p>
        </div>
        <div id="spectator-controls" class="spectator-controls hidden">
          <span class="spectator-badge">👁 Spectating</span>
          <button id="btn-flip-board" class="btn btn-secondary btn-small">⇅ Flip</button>
        </div>
        <div id="game-id-display" class="game-id-display"></div>
      </div>
      <div class="game-layout">
        <div class="board-wrapper">
          <div class="board-column">
            <div id="player-names-bar" class="player-names-bar hidden"></div>
            <div class="timer-card" id="timer-top">
              <div class="timer-info">
                <span class="timer-dot timer-dot--black" id="timer-top-dot"></span>
                <span class="timer-player-label" id="timer-top-label">Opponent</span>
              </div>
              <div class="timer-display" id="timer-top-display">—</div>
            </div>
            <div class="board-frame">
              <div class="rank-labels" id="rank-labels"></div>
              <div id="board"></div>
              <div class="file-labels" id="file-labels"></div>
            </div>
            <div class="timer-card" id="timer-bottom">
              <div class="timer-info">
                <span class="timer-dot timer-dot--white" id="timer-bottom-dot"></span>
                <span class="timer-player-label" id="timer-bottom-label">You</span>
              </div>
              <div class="timer-display" id="timer-bottom-display">—</div>
            </div>
            <div id="status-bar" class="status-bar">
              <span id="status-text">Sign in and create or join a game to begin.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="toast" class="toast"></div>

    <div id="game-over-modal" class="hidden" style="position:fixed;inset:0;background:rgba(255,255,255,0.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:1000;flex-direction:column;">
      <div style="background:var(--bg-secondary);padding:40px;border-radius:20px;box-shadow:var(--shadow-panel);text-align:center;border:1px solid var(--bg-glass-border);">
        <h2 id="game-over-title" style="font-family:'Playfair Display',serif;font-size:2.5rem;margin-bottom:10px;color:var(--accent);">Game Over</h2>
        <p id="game-over-message" style="color:var(--text-secondary);margin-bottom:24px;">Message</p>
        <button id="btn-new-game" class="btn btn-primary">Play Again</button>
      </div>
    </div>
  `;

  buildLabels();

  // ── State ──────────────────────────────────────────────────────────────────
  let game            = new Game();
  let currentUser: any = null;
  let currentGameId: string | null   = null;
  let currentUserColor: PieceColor | null = null;
  let currentGameData: GameDocument | null = null;
  let unsubscribe: (() => void) | null = null;
  let timer           = new ChessTimer();
  let timeoutWritten  = false;
  let isFirstSnapshot = true;
  let isSpectator     = false;
  let boardFlipped    = false;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const boardEl           = document.getElementById("board")!;
  const landingScreen     = document.querySelector(".landing-screen")!;
  const gameScreen        = document.querySelector(".game-screen")!;
  const gameStateText     = document.getElementById("game-state-text")!;
  const gameIdDisplay     = document.getElementById("game-id-display")!;
  const statusText        = document.getElementById("status-text")!;
  const gameOverModal     = document.getElementById("game-over-modal")!;
  const gameOverTitle     = document.getElementById("game-over-title")!;
  const gameOverMessage   = document.getElementById("game-over-message")!;
  const btnNewGame        = document.getElementById("btn-new-game")!;
  const timerTopCard      = document.getElementById("timer-top")!;
  const timerBottomCard   = document.getElementById("timer-bottom")!;
  const timerTopDot       = document.getElementById("timer-top-dot")!;
  const timerBottomDot    = document.getElementById("timer-bottom-dot")!;
  const timerTopLabel     = document.getElementById("timer-top-label")!;
  const timerBottomLabel  = document.getElementById("timer-bottom-label")!;
  const timerTopDisplay   = document.getElementById("timer-top-display")!;
  const timerBottomDisplay = document.getElementById("timer-bottom-display")!;
  const spectatorControls = document.getElementById("spectator-controls")!;
  const playerNamesBar    = document.getElementById("player-names-bar")!;

  // ── Timer rendering ────────────────────────────────────────────────────────
  function renderTimers(state: TimerState) {
    const active = timer.getActiveColor();
    const LOW    = 30_000;

    let topColor: "white" | "black";
    let bottomColor: "white" | "black";

    if (isSpectator) {
      topColor    = boardFlipped ? "white" : "black";
      bottomColor = boardFlipped ? "black" : "white";
    } else if (currentUserColor) {
      topColor    = currentUserColor === "white" ? "black" : "white";
      bottomColor = currentUserColor;
    } else {
      return;
    }

    timerTopDisplay.textContent    = fmt(state[topColor]);
    timerBottomDisplay.textContent = fmt(state[bottomColor]);

    timerTopCard.classList.toggle("active",    active === topColor);
    timerTopCard.classList.toggle("low-time",  active === topColor && state[topColor] < LOW);
    timerBottomCard.classList.toggle("active",    active === bottomColor);
    timerBottomCard.classList.toggle("low-time",  active === bottomColor && state[bottomColor] < LOW);
  }

  function resetTimerCards() {
    timerTopDisplay.textContent    = "—";
    timerBottomDisplay.textContent = "—";
    timerTopCard.classList.remove("active", "low-time");
    timerBottomCard.classList.remove("active", "low-time");
  }

  function applyColorLabels() {
    let topColor: "white" | "black";
    let bottomColor: "white" | "black";
    let topLabel: string;
    let bottomLabel: string;

    if (isSpectator) {
      topColor    = boardFlipped ? "white" : "black";
      bottomColor = boardFlipped ? "black" : "white";
      topLabel    = topColor === "black" ? "Black" : "White";
      bottomLabel = bottomColor === "white" ? "White" : "Black";
    } else if (currentUserColor) {
      topColor    = currentUserColor === "white" ? "black" : "white";
      bottomColor = currentUserColor;
      topLabel    = "Opponent";
      bottomLabel = "You";
    } else {
      return;
    }

    timerTopDot.className      = `timer-dot timer-dot--${topColor}`;
    timerTopLabel.textContent  = topLabel;
    timerBottomDot.className   = `timer-dot timer-dot--${bottomColor}`;
    timerBottomLabel.textContent = bottomLabel;
    buildLabels(boardFlipped && isSpectator ? "black" : (currentUserColor ?? "white"));
  }

  function updateSpectatorUI(data: GameDocument) {
    spectatorControls.classList.toggle("hidden", !isSpectator);

    if (isSpectator && data.players.black) {
      playerNamesBar.classList.remove("hidden");
      const wId = data.players.white.slice(0, 10) + "…";
      const bId = data.players.black.slice(0, 10) + "…";
      const topColor    = boardFlipped ? "white" : "black";
      const bottomColor = boardFlipped ? "black" : "white";
      const topName     = topColor === "white" ? wId : bId;
      const bottomName  = bottomColor === "white" ? wId : bId;
      playerNamesBar.innerHTML = `
        <span class="player-name-chip player-name-chip--${topColor}">${topColor === "white" ? "♙" : "♟"} ${topName}</span>
        <span class="vs-sep">vs</span>
        <span class="player-name-chip player-name-chip--${bottomColor}">${bottomColor === "white" ? "♙" : "♟"} ${bottomName}</span>`;
    } else {
      playerNamesBar.classList.add("hidden");
    }
  }

  // ── Timer callbacks ────────────────────────────────────────────────────────
  function setupTimerCallbacks() {
    timer.onTick((state) => renderTimers(state));
    timer.onTimeout((loser) => {
      if (isSpectator)  return;
      if (timeoutWritten) return;
      if (!currentGameId) return;
      if (loser !== currentUserColor) return;
      timeoutWritten = true;
      makeTimeoutMove(currentGameId, loser).catch(() => { timeoutWritten = false; });
    });
  }

  function initTimer(data: GameDocument) {
    timer.restoreFromSnapshot(
      data.timers,
      data.timerStartedAt,
      data.status === "playing" ? data.turn : null
    );
    if (data.status === "playing") timer.start(data.turn);
    renderTimers(timer.getState());
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  function setGameScreenActive(active: boolean) {
    landingScreen.classList.toggle("hidden",  active);
    gameScreen.classList.toggle("hidden", !active);
  }

  function renderCurrentUser() {
    const ua = document.getElementById("user-area")!;
    ua.innerHTML = currentUser
      ? `<div class="user-badge"><div class="user-icon">✓</div><div><div class="user-name">${currentUser.displayName}</div><div class="user-status">Online</div></div></div>`
      : "";
  }

  function getValidMoves(): string[] {
    if (isSpectator || !currentGameData || !currentUserColor || !game.selectedSquare) return [];
    if (!game.isOwnPiece(game.selectedSquare)) return [];
    return game.getLegalMoves(game.selectedSquare);
  }

  function findKingInCheck(): string | null {
    if (!game.isInCheck(game.turn)) return null;
    const state = game.getBoardState();
    for (const sq of Object.keys(state)) {
      const p = state[sq];
      if (p && p.type === "king" && p.color === game.turn) return sq;
    }
    return null;
  }

  function updateStatusBar() {
    if (!currentGameData) { statusText.textContent = "Sign in and create or join a game to begin."; return; }
    const s = currentGameData.status;
    if (s === "waiting")   { statusText.textContent = "Waiting for an opponent…"; return; }
    if (s === "checkmate") { statusText.textContent = `Checkmate! ${currentGameData.winner} wins.`; return; }
    if (s === "stalemate") { statusText.textContent = "Stalemate! Game is a draw."; return; }
    if (s === "draw")      { statusText.textContent = "Game drawn."; return; }
    if (s === "timeout")   { statusText.textContent = `Time's up! ${currentGameData.winner} wins on time.`; return; }
    if (isSpectator) {
      statusText.textContent = `${game.turn === "white" ? "White" : "Black"} to move`;
    } else {
      statusText.textContent = (currentUserColor && game.turn === currentUserColor) ? "Your turn" : "Opponent's turn";
    }
  }

  function updateTopBar() {
    if (!currentGameData || !currentGameId) {
      gameStateText.textContent = "Create or join a game to start.";
      gameIdDisplay.innerHTML = "";
      return;
    }
    const s = currentGameData.status;
    gameStateText.textContent =
      s === "waiting"                  ? "Waiting for opponent…" :
      s === "checkmate"                ? "Checkmate" :
      s === "stalemate" || s === "draw"? "Draw" :
      s === "timeout"                  ? "Time's up!" :
      `${game.turn === "white" ? "White" : "Black"} to move`;

    gameIdDisplay.innerHTML = `
      <div class="game-id-display" id="copy-btn" title="Click to copy">
        <span class="label">Game ID</span>
        <span class="id-text">${currentGameId}</span>
        <span class="copy-icon">📋</span>
      </div>`;
    document.getElementById("copy-btn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(currentGameId!);
      showToast("Game ID copied");
    });
  }

  function refresh() {
    const orientation = isSpectator
      ? (boardFlipped ? "black" : "white")
      : (currentUserColor ?? "white");
    const options: RenderOptions = {
      validMoves: getValidMoves(),
      lastMove: null,
      inCheck: findKingInCheck(),
      orientation,
    };
    renderBoard(boardEl, game.getBoardState(), game.selectedSquare, handleClick, options);
    updateStatusBar();
    updateTopBar();

    const s = currentGameData?.status;
    if (s === "checkmate" || s === "stalemate" || s === "draw" || s === "timeout") {
      gameOverModal.classList.remove("hidden");
      gameOverModal.style.display = "flex";
      if (s === "checkmate") {
        gameOverTitle.textContent   = "Checkmate!";
        gameOverMessage.textContent = `${currentGameData!.winner} wins by checkmate.`;
      } else if (s === "timeout") {
        gameOverTitle.textContent   = "Time's Up!";
        gameOverMessage.textContent = `${currentGameData!.winner} wins on time.`;
      } else {
        gameOverTitle.textContent   = "Draw";
        gameOverMessage.textContent = s === "stalemate" ? "Stalemate!" : "Game ended in a draw.";
      }
    } else {
      gameOverModal.classList.add("hidden");
      gameOverModal.style.display = "none";
    }
  }

  // ── Move handler ───────────────────────────────────────────────────────────
  async function handleClick(square: string) {
    if (isSpectator) return;
    if (!currentGameData || !currentGameId || !currentUserColor) return;
    if (game.turn !== currentUserColor) return;
    if (currentGameData.status !== "playing") return;

    if (game.isOwnPiece(square)) { game.selectSquare(square); refresh(); return; }

    if (game.selectedSquare && game.getLegalMoves(game.selectedSquare).includes(square)) {
      const from = game.selectedSquare;
      const isCapture = !!game.getBoardState()[square];
      if (game.move(from, square, "queen")) {
        const isCheck = game.isInCheck(game.turn);
        if (isCheck) playSound("check");
        else if (isCapture) playSound("capture");
        else playSound("move");

        const movedColor = currentUserColor;
        const nextTurn   = game.turn;
        const newTimers  = timer.switchAfterMove(movedColor, nextTurn);
        const now        = Date.now();
        const newStatus  = game.getGameState();
        const status: "playing" | "checkmate" | "stalemate" | "draw" =
          newStatus === "waiting" ? "playing" : (newStatus as any);
        const winnerName = status === "checkmate"
          ? (movedColor === "white" ? "White" : "Black") : undefined;

        if (status !== "playing") timer.pause();
        try {
          await makeMove(currentGameId, game.fen(), nextTurn, status, winnerName, newTimers, now);
        } catch {
          showToast("Move failed. Please try again.");
        }
      }
      refresh(); return;
    }
    game.clearSelection(); refresh();
  }

  function showToast(message: string) {
    const toast = document.getElementById("toast")!;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  // ── Firebase listener ──────────────────────────────────────────────────────
  async function initializeGameListener(gameId: string) {
    if (unsubscribe) unsubscribe();
    isFirstSnapshot = true;

    unsubscribe = listenToGame(gameId, (data) => {
      if (!data) { showToast("Game not found."); return; }

      const oldFen        = currentGameData?.fen;
      const oldStatus     = currentGameData?.status;
      const oldPieceCount = Object.keys(game.getBoardState()).length;

      currentGameData = data;
      if (data.fen) game.load(data.fen);
      const newPieceCount = Object.keys(game.getBoardState()).length;

      // Sounds
      if (oldStatus === "waiting" && data.status === "playing") playSound("start");
      const gameEnded = ["checkmate","stalemate","draw","timeout"].includes(data.status);
      if (gameEnded && oldStatus === "playing") playSound("end");

      if (oldFen && oldFen !== data.fen && data.status === "playing") {
        // Players: only on opponent's move; spectators: always
        if (isSpectator || game.turn === currentUserColor) {
          if (game.isInCheck(game.turn)) playSound("check");
          else if (newPieceCount < oldPieceCount) playSound("capture");
          else playSound("move");
        }
      }

      // Timer sync
      if (isFirstSnapshot) {
        // Reconnect guard: restore role if currentUserColor was lost
        if (currentUser && currentUserColor === null && !isSpectator) {
          const uid = currentUser.uid;
          if      (data.players.white === uid) currentUserColor = "white";
          else if (data.players.black === uid) currentUserColor = "black";
          else isSpectator = true;
        }
        isFirstSnapshot = false;
        applyColorLabels();
        initTimer(data);
        setupTimerCallbacks();
      } else if (data.status === "playing") {
        if (oldStatus === "waiting") {
          timer.restoreFromSnapshot(data.timers, data.timerStartedAt, data.turn);
          timer.start(data.turn);
        } else if (oldFen !== data.fen) {
          // Spectators always re-sync; players only when it becomes their turn
          if (isSpectator || game.turn === currentUserColor) {
            timer.restoreFromSnapshot(data.timers, data.timerStartedAt, data.turn);
            timer.start(data.turn);
          }
        }
        applyColorLabels();
      } else if (gameEnded) {
        timer.pause();
        applyColorLabels();
      }

      updateSpectatorUI(data);
      if (data.timers) renderTimers(timer.getState());
      game.clearSelection();
      setGameScreenActive(true);
      refresh();
    });
  }

  // ── Button handlers ────────────────────────────────────────────────────────
  document.getElementById("login")!.onclick = async () => {
    try {
      currentUser = await loginWithGoogle();
      renderCurrentUser();
      document.getElementById("login")!.style.display = "none";
      showToast(`Welcome, ${currentUser.displayName}!`);
    } catch { showToast("Login failed. Please try again."); }
  };

  document.getElementById("create")!.onclick = async () => {
    if (!currentUser) { showToast("Please sign in with Google first."); return; }
    const sel    = document.getElementById("time-control") as HTMLSelectElement;
    const preset = TIME_PRESETS[Number(sel.value)] ?? TIME_PRESETS[5];
    try {
      const id = await createGame(currentUser.uid, preset.value);
      currentGameId    = id;
      currentUserColor = "white";
      isSpectator      = false;
      boardFlipped     = false;
      timeoutWritten   = false;
      timer.destroy();
      timer = new ChessTimer({ initialMs: preset.value.initialMs, incrementMs: preset.value.incrementMs });
      setupTimerCallbacks();
      resetTimerCards();
      applyColorLabels();
      await initializeGameListener(id);
      showToast("Game created. Share the game ID with your opponent.");
    } catch { showToast("Unable to create game. Please try again."); }
  };

  document.getElementById("join")!.onclick = async () => {
    if (!currentUser) { showToast("Please sign in with Google first."); return; }
    const enteredId = (document.getElementById("gameInput") as HTMLInputElement).value.trim();
    if (!enteredId) { showToast("Enter a game ID to join."); return; }

    try {
      const existing = await getGame(enteredId);
      if (!existing) { showToast("Game not found."); return; }

      const uid = currentUser.uid;
      timeoutWritten = false;
      boardFlipped   = false;

      if (existing.players.white === uid) {
        currentGameId = enteredId; currentUserColor = "white"; isSpectator = false;
      } else if (existing.players.black === uid) {
        currentGameId = enteredId; currentUserColor = "black"; isSpectator = false;
      } else if (!existing.players.black) {
        await joinGame(enteredId, uid);
        currentGameId = enteredId; currentUserColor = "black"; isSpectator = false;
        showToast("Joined game successfully.");
      } else {
        // Game is full — enter spectator mode
        currentGameId = enteredId; currentUserColor = null; isSpectator = true;
        showToast("Game is full — you are now spectating.");
      }

      timer.destroy();
      timer = new ChessTimer();
      resetTimerCards();
      applyColorLabels();
      await initializeGameListener(enteredId);
    } catch (e) { showToast((e as Error).message || "Unable to join game."); }
  };

  document.getElementById("btn-flip-board")!.onclick = () => {
    if (!isSpectator) return;
    boardFlipped = !boardFlipped;
    applyColorLabels();
    if (currentGameData) updateSpectatorUI(currentGameData);
    refresh();
    renderTimers(timer.getState());
  };

  btnNewGame.onclick = () => {
    timer.pause();
    gameOverModal.classList.add("hidden");
    setGameScreenActive(false);
    resetTimerCards();
    isSpectator  = false;
    boardFlipped = false;
    spectatorControls.classList.add("hidden");
    playerNamesBar.classList.add("hidden");
  };

  setGameScreenActive(false);
  renderCurrentUser();
  refresh();
}

function buildLabels(orientation: "white" | "black" = "white") {
  const rankContainer = document.getElementById("rank-labels")!;
  const fileContainer = document.getElementById("file-labels")!;
  const flipped = orientation === "black";
  const ranks = flipped ? ["1","2","3","4","5","6","7","8"] : ["8","7","6","5","4","3","2","1"];
  const files = flipped ? ["h","g","f","e","d","c","b","a"] : ["a","b","c","d","e","f","g","h"];
  rankContainer.innerHTML = ranks.map(r => `<span>${r}</span>`).join("");
  fileContainer.innerHTML = files.map(f => `<span>${f}</span>`).join("");
}

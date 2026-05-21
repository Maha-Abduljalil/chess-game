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
import { AIGameController } from "../controllers/AIGameController";
import { SpectatorController } from "../controllers/SpectatorController";
import { EngineDifficulty } from "../services/engineService";
import { sendChatMessage, listenToChat } from "../services/chatService";
import { renderChatMessages } from "./renderChat";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getProfile, getAvatarUrl, syncWithAuthUser, recordGameResult } from "../services/profileService";
import { renderProfileScreen } from "./renderProfile";

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
      <div class="landing-panel">
        <div class="hero-copy">
          <span class="hero-eyebrow">Real-time Chess</span>
          <h1>Play Online With Your Friends</h1>
          <p>Sign in, create a game, or challenge the AI.</p>
        </div>

        <div class="mode-selector">
          <button id="mode-multiplayer" class="btn btn-secondary mode-btn active">Multiplayer Mode</button>
          <button id="mode-ai" class="btn btn-secondary mode-btn">AI Mode</button>
        </div>

        <div id="multiplayer-section" class="mode-section">
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
        </div>

        <div id="ai-section" class="mode-section hidden">
          <div class="ai-config">
            <div class="time-control-row">
              <label class="tc-label" for="ai-difficulty">AI Difficulty</label>
              <select id="ai-difficulty" class="tc-select">
                <option value="easy">Easy</option>
                <option value="medium" selected>Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div class="time-control-row">
              <label class="tc-label" for="ai-side">Play As</label>
              <select id="ai-side" class="tc-select">
                <option value="white" selected>White</option>
                <option value="black">Black</option>
              </select>
            </div>
            <button id="play-ai" class="btn btn-primary" style="margin-top: 10px;">Play vs AI</button>
          </div>
        </div>

        <div id="profile-area"></div>
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
          <div class="eval-container hidden" id="eval-container">
            <span class="eval-text" id="eval-text">0.0</span>
            <div class="eval-bar">
              <div class="eval-fill" id="eval-fill"></div>
            </div>
          </div>
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
          <div class="side-panel">
            <div id="game-over-side" class="game-over-side hidden">
              <div class="side-panel-header">Game Over</div>
              <h3 id="game-over-title-side">—</h3>
              <p id="game-over-message-side">—</p>
              <button id="btn-new-game-side" class="btn btn-primary" style="width: 100%; margin-top: 16px;">Play Again</button>
            </div>
            <div class="spectator-panel hidden" id="spectator-panel">
              <div class="spectator-panel-header">Engine Analysis</div>
              <div class="analysis-stat"><span>Best Move</span> <strong id="spec-best-move">—</strong></div>
              <div class="analysis-stat"><span>Evaluation</span> <strong id="spec-eval">—</strong></div>
              <div class="analysis-stat"><span>Depth</span> <strong id="spec-depth">—</strong></div>
            </div>
            
            <div id="chat-panel" class="chat-panel hidden">
              <div class="side-panel-header">Game Chat</div>
              <div id="chat-messages" class="chat-messages">
                <div class="empty-chat-msg">No messages yet. Say hi!</div>
              </div>
              <div class="chat-input-area">
                <input id="chat-input" type="text" placeholder="Send a message..." maxlength="200" />
                <button id="chat-send" class="btn btn-primary btn-icon" title="Send">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="toast" class="toast"></div>
  `;

  buildLabels();

  // State 
  let game            = new Game();
  let currentUser: any = null;

  onAuthStateChanged(auth, (user) => {
    console.log("Auth state changed:", user ? `Logged in as ${user.displayName}` : "Logged out");
    currentUser = user;
    if (user) {
      syncWithAuthUser({ displayName: user.displayName, photoURL: user.photoURL });
    }
    renderProfileButton();
    const loginBtn = document.getElementById("login");
    if (loginBtn) {
      loginBtn.style.display = user ? "none" : "block";
    }
    refresh();
  });
  let currentGameId: string | null   = null;
  let currentUserColor: PieceColor | null = null;
  let currentGameData: GameDocument | null = null;
  let unsubscribe: (() => void) | null = null;
  let chatUnsubscribe: (() => void) | null = null;
  let timer           = new ChessTimer();
  let timeoutWritten  = false;
  let isFirstSnapshot = true;
  let isSpectator     = false;
  let boardFlipped    = false;
  let gameResultRecorded = false;
  
  let aiController: AIGameController | null = null;
  let spectatorController: SpectatorController | null = null;
  let currentEval = 0.0;

  //DOM refs 
  const boardEl           = document.getElementById("board")!;
  const landingScreen     = document.querySelector(".landing-screen")!;
  const gameScreen        = document.querySelector(".game-screen")!;
  const gameStateText     = document.getElementById("game-state-text")!;
  const gameIdDisplay     = document.getElementById("game-id-display")!;
  const statusText        = document.getElementById("status-text")!;
  const gameOverSide      = document.getElementById("game-over-side")!;
  const gameOverTitleSide = document.getElementById("game-over-title-side")!;
  const gameOverMsgSide   = document.getElementById("game-over-message-side")!;
  const btnNewGame        = document.getElementById("btn-new-game-side")!;
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

  const evalContainer     = document.getElementById("eval-container")!;
  const evalFill          = document.getElementById("eval-fill")!;
  const evalText          = document.getElementById("eval-text")!;
  
  const spectatorPanel    = document.getElementById("spectator-panel")!;
  const specBestMove      = document.getElementById("spec-best-move")!;
  const specEval          = document.getElementById("spec-eval")!;
  const specDepth         = document.getElementById("spec-depth")!;

  const chatPanel         = document.getElementById("chat-panel")!;
  const chatMessages      = document.getElementById("chat-messages")!;
  const chatInput         = document.getElementById("chat-input") as HTMLInputElement;
  const chatSendBtn       = document.getElementById("chat-send")!;

  //Timer rendering 
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

  function updateEvalBar(score: number, mate: number | null) {
    evalContainer.classList.remove("hidden");
    let displayScore = "";
    let fillHeight = "50%";
    
    if (mate !== null) {
      displayScore = `M${Math.abs(mate)}`;
      fillHeight = mate > 0 ? "100%" : "0%";
    } else {
      displayScore = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
      // Map -10 to +10 score to 0% to 100% height, cap it.
      let h = 50 + (score * 5);
      h = Math.max(0, Math.min(100, h));
      fillHeight = `${h}%`;
    }
    
    evalText.textContent = displayScore;
    evalFill.style.height = fillHeight;
  }

  // ── Timer callbacks 
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

  // UI helpers 
  function setGameScreenActive(active: boolean) {
    landingScreen.classList.toggle("hidden",  active);
    gameScreen.classList.toggle("hidden", !active);
  }

  function renderProfileButton() {
    const pa = document.getElementById("profile-area")!;
    if (!pa) return;
    const profile = getProfile();
    const avatarSrc = getAvatarUrl(profile);
    pa.innerHTML = `
      <button id="profile-btn" class="profile-btn-landing">
        <img src="${avatarSrc}" alt="Profile" class="profile-btn-avatar" />
        <div class="profile-btn-info">
          <span class="profile-btn-name">${profile.username}</span>
          <span class="profile-btn-stats">${profile.gamesPlayed} games · ${profile.wins}W / ${profile.losses}L</span>
        </div>
        <svg class="profile-btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;
    document.getElementById("profile-btn")!.onclick = () => {
      renderProfileScreen(app, () => {
        // Re-init the entire UI when coming back from profile
        initChessUI(loginWithGoogle);
      });
    };
  }

  function recordResult(outcome: "win" | "loss" | "draw") {
    if (gameResultRecorded) return;
    gameResultRecorded = true;
    recordGameResult(outcome);
  }

  function getValidMoves(): string[] {
    if ((isSpectator && !aiController) || (!currentGameData && !aiController) || !currentUserColor || !game.selectedSquare) return [];
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
    if (aiController) {
      const s = game.getGameState();
      if (s === "checkmate") { statusText.textContent = `Checkmate! ${game.turn === "white" ? "Black" : "White"} wins.`; return; }
      if (s === "stalemate") { statusText.textContent = "Stalemate! Game is a draw."; return; }
      if (s === "draw")      { statusText.textContent = "Game drawn."; return; }
      statusText.textContent = (currentUserColor && game.turn === currentUserColor) ? "Your turn" : "AI's turn";
      return;
    }
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
    if (aiController) {
      const s = game.getGameState();
      gameStateText.textContent =
        s === "checkmate"                ? "Checkmate" :
        s === "stalemate" || s === "draw"? "Draw" :
        `${game.turn === "white" ? "White" : "Black"} to move`;
      gameIdDisplay.innerHTML = `<div class="game-id-display"><span class="label">VS</span><span class="id-text">Stockfish</span></div>`;
      return;
    }
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
      lastMove: game.getLastMove(),
      inCheck: findKingInCheck(),
      orientation,
      moveQualities: aiController ? aiController.moveQualities : undefined,
    };
    renderBoard(boardEl, game.getBoardState(), game.selectedSquare, handleClick, options);
    updateStatusBar();
    updateTopBar();

    const s = aiController ? game.getGameState() : currentGameData?.status;
    if (s === "checkmate" || s === "stalemate" || s === "draw" || s === "timeout") {
      gameOverSide.classList.remove("hidden");
      if (s === "checkmate") {
        gameOverTitleSide.textContent   = "Checkmate!";
        const winner = aiController ? (game.turn === "white" ? "Black" : "White") : currentGameData!.winner;
        gameOverMsgSide.textContent = `${winner} wins.`;
        // Record profile stats
        if (!aiController && currentUserColor && currentGameData) {
          const winnerColor = currentGameData.winner;
          const myColor = currentUserColor === "white" ? "White" : "Black";
          recordResult(winnerColor === myColor ? "win" : "loss");
        }
      } else if (s === "timeout") {
        gameOverTitleSide.textContent   = "Time's Up!";
        gameOverMsgSide.textContent = `${currentGameData!.winner} wins on time.`;
        // Record profile stats
        if (!aiController && currentUserColor && currentGameData) {
          const winnerColor = currentGameData.winner;
          const myColor = currentUserColor === "white" ? "White" : "Black";
          recordResult(winnerColor === myColor ? "win" : "loss");
        }
      } else {
        gameOverTitleSide.textContent   = "Draw";
        gameOverMsgSide.textContent = s === "stalemate" ? "Stalemate!" : "Game ended in a draw.";
        // Record draw
        if (!isSpectator && !aiController) {
          recordResult("draw");
        }
      }
    } else {
      gameOverSide.classList.add("hidden");
    }
  }

  // Move handler 
  async function handleClick(square: string) {
    if (isSpectator && !aiController) return;
    
    if (aiController) {
      if (game.isOwnPiece(square)) { game.selectSquare(square); refresh(); return; }
      if (game.getGameState() === "playing" && game.selectedSquare && game.getLegalMoves(game.selectedSquare).includes(square)) {
        const from = game.selectedSquare;
        await aiController.handlePlayerMove(from, square, "queen");
        game.clearSelection();
        refresh();
      } else {
        game.clearSelection(); refresh();
      }
      return;
    }

    if (!currentGameData || !currentGameId || !currentUserColor) return;
    if (game.turn !== currentUserColor) return;
    
    // Selection allowed after game over for inspection
    if (game.isOwnPiece(square)) { game.selectSquare(square); refresh(); return; }

    // Moves only allowed if game is playing
    if (currentGameData.status !== "playing") {
      game.clearSelection(); refresh();
      return;
    }

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

  // Firebase listener 
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

      if (isSpectator) {
        spectatorPanel.classList.remove("hidden");
        if (!spectatorController) {
          spectatorController = new SpectatorController((data, bestMove) => {
            currentEval = data.score;
            updateEvalBar(data.score, data.mate);
            specEval.textContent = data.mate !== null ? `M${Math.abs(data.mate)}` : data.score.toFixed(1);
            specDepth.textContent = data.depth.toString();
            specBestMove.textContent = bestMove || "—";
          });
        }
        spectatorController.analyzePosition(game.fen());
      } else {
        spectatorPanel.classList.add("hidden");
        evalContainer.classList.add("hidden");
      }

      updateSpectatorUI(data);
      if (data.timers) renderTimers(timer.getState());
      game.clearSelection();
      setGameScreenActive(true);
      
      if (currentGameId && !chatUnsubscribe) {
        chatPanel.classList.remove("hidden");
        chatUnsubscribe = listenToChat(currentGameId, (messages) => {
          renderChatMessages(chatMessages, messages);
        });
      }

      refresh();
    });
  }

  // Mode selection 
  const modeMultiplayerBtn = document.getElementById("mode-multiplayer")!;
  const modeAIBtn          = document.getElementById("mode-ai")!;
  const multiplayerSection = document.getElementById("multiplayer-section")!;
  const aiSection          = document.getElementById("ai-section")!;

  modeMultiplayerBtn.onclick = () => {
    modeMultiplayerBtn.classList.add("active");
    modeAIBtn.classList.remove("active");
    multiplayerSection.classList.remove("hidden");
    aiSection.classList.add("hidden");
  };

  modeAIBtn.onclick = () => {
    modeAIBtn.classList.add("active");
    modeMultiplayerBtn.classList.remove("active");
    aiSection.classList.remove("hidden");
    multiplayerSection.classList.add("hidden");
  };

  // Button handlers 
  document.getElementById("login")!.onclick = async () => {
    try {
      currentUser = await loginWithGoogle();
      document.getElementById("login")!.style.display = "none";
      showToast(`Welcome, ${currentUser.displayName}!`);
    } catch { showToast("Login failed. Please try again."); }
  };

  document.getElementById("create")!.onclick = async () => {
    if (!currentUser) { showToast("Please sign in with Google first."); return; }
    
    if (aiController) { aiController.stop(); aiController = null; }
    if (spectatorController) { spectatorController.stop(); spectatorController = null; }
    gameResultRecorded = false;
    
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
    } catch (err) {
      console.error("FAILED_TO_CREATE_GAME:", err);
      const msg = err instanceof Error ? err.message : "Internal error";
      showToast(`Unable to create game: ${msg}`);
    }
  };

  document.getElementById("join")!.onclick = async () => {
    if (!currentUser) { showToast("Please sign in with Google first."); return; }
    const enteredId = (document.getElementById("gameInput") as HTMLInputElement).value.trim();
    if (!enteredId) { showToast("Enter a game ID to join."); return; }

    if (aiController) { aiController.stop(); aiController = null; }
    if (spectatorController) { spectatorController.stop(); spectatorController = null; }
    gameResultRecorded = false;

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

  document.getElementById("play-ai")!.onclick = () => {
    const diffElement = document.getElementById("ai-difficulty") as HTMLSelectElement;
    const sideElement = document.getElementById("ai-side") as HTMLSelectElement;
    
    const difficulty = diffElement.value as EngineDifficulty;
    let side = sideElement.value as "white" | "black" | "random";
    if (side === "random") {
      side = Math.random() > 0.5 ? "white" : "black";
    }

    if (aiController) { aiController.stop(); }
    if (spectatorController) { spectatorController.stop(); spectatorController = null; }
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    gameResultRecorded = false;

    game = new Game();
    currentUserColor = side as "white" | "black";
    isSpectator = false;
    boardFlipped = currentUserColor === "black";
    currentGameId = null;
    currentGameData = null;
    
    timer.destroy();
    resetTimerCards();
    applyColorLabels();

    aiController = new AIGameController(game, difficulty, currentUserColor, () => refresh());
    aiController.startGame();

    chatPanel.classList.add("hidden"); // Chat is only for multiplayer
    setGameScreenActive(true);
    refresh();
    showToast(`Playing AI on ${difficulty} as ${side}.`);
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
    gameOverSide.classList.add("hidden");
    setGameScreenActive(false);
    resetTimerCards();
    isSpectator  = false;
    boardFlipped = false;
    spectatorControls.classList.add("hidden");
    playerNamesBar.classList.add("hidden");
    evalContainer.classList.add("hidden");
    spectatorPanel.classList.add("hidden");
    
    if (aiController) { aiController.stop(); aiController = null; }
    if (spectatorController) { spectatorController.stop(); spectatorController = null; }
    if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
    chatMessages.innerHTML = "";
  };

  async function handleSendMessage() {
    if (!currentGameId || !currentUser) return;
    const text = chatInput.value.trim();
    if (!text) return;

    const side = isSpectator ? "spectator" : (currentUserColor || "spectator");
    
    try {
      chatInput.value = "";
      await sendChatMessage(currentGameId, {
        userId: currentUser.uid,
        userName: currentUser.displayName || "Anonymous",
        side,
        text,
      });
    } catch (e) {
      showToast("Failed to send message.");
      chatInput.value = text;
    }
  }

  chatSendBtn.onclick = handleSendMessage;
  chatInput.onkeydown = (e) => {
    if (e.key === "Enter") handleSendMessage();
  };

  setGameScreenActive(false);
  renderProfileButton();
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

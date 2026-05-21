export type EngineDifficulty = "easy" | "medium" | "hard" | "expert";

export interface EvaluationData {
  depth: number;
  score: number; 
  mate: number | null; 
  pv: string; 
}

export class StockfishEngine {
  private worker: Worker;
  private isReady = false;
  private isSearching = false;
  private evalCallback: ((data: EvaluationData) => void) | null = null;
  private bestMoveCallback: ((move: string) => void) | null = null;

  constructor() {
    this.worker = new Worker("/stockfish/stockfish.js");
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.postMessage("uci");
  }

  private handleMessage(event: MessageEvent) {
    const line = event.data;
    
    if (line === "uciok") {
      this.isReady = true;
    } else if (line === "readyok") {
      this.isReady = true;
    } else if (line.startsWith("info ")) {
      this.parseInfo(line);
    } else if (line.startsWith("bestmove ")) {
      this.isSearching = false;
      const move = line.split(" ")[1];
      if (this.bestMoveCallback) {
        this.bestMoveCallback(move);
        this.bestMoveCallback = null;
      }
    }
  }

  private parseInfo(line: string) {
    if (!this.evalCallback) return;
    
    const depthMatch = line.match(/depth (\d+)/);
    const scoreCpMatch = line.match(/score cp (-?\d+)/);
    const scoreMateMatch = line.match(/score mate (-?\d+)/);
    const pvMatch = line.match(/ pv (.+)/);

    if (!depthMatch || (!scoreCpMatch && !scoreMateMatch)) return;

    const depth = parseInt(depthMatch[1], 10);
    const mate = scoreMateMatch ? parseInt(scoreMateMatch[1], 10) : null;
    const scoreCp = scoreCpMatch ? parseInt(scoreCpMatch[1], 10) : (mate ? (mate > 0 ? 10000 : -10000) : 0);
    const pv = pvMatch ? pvMatch[1] : "";

    this.evalCallback({
      depth,
      score: scoreCp / 100, // convert to standard pawn units
      mate,
      pv,
    });
  }

  public setDifficulty(difficulty: EngineDifficulty) {
    // We adjust both Skill Level and Depth for a realistic progression
    let skillLevel = 20;
    
    switch (difficulty) {
      case "easy": skillLevel = 1; break;
      case "medium": skillLevel = 5; break;
      case "hard": skillLevel = 10; break;
      case "expert": skillLevel = 20; break;
    }

    this.worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
  }

  public evaluatePosition(fen: string, callback: (data: EvaluationData) => void) {
    this.stop();
    this.evalCallback = callback;
    this.worker.postMessage(`position fen ${fen}`);
    // A quick evaluation to update UI continuously
    this.worker.postMessage("go depth 14");
  }

  public findBestMove(
    fen: string, 
    difficulty: EngineDifficulty, 
    callback: (move: string) => void,
    evalCallback?: (data: EvaluationData) => void
  ) {
    this.stop();
    this.setDifficulty(difficulty);
    this.bestMoveCallback = callback;
    if (evalCallback) {
      this.evalCallback = evalCallback;
    }
    this.worker.postMessage(`position fen ${fen}`);
    
    let depth = 20;
    switch (difficulty) {
      case "easy": depth = 3; break; // very shallow, prone to blunders
      case "medium": depth = 8; break;
      case "hard": depth = 12; break;
      case "expert": depth = 18; break;
    }
    
    this.isSearching = true;
    this.worker.postMessage(`go depth ${depth}`);
  }

  public stop() {
    if (this.isSearching) {
      this.worker.postMessage("stop");
      this.isSearching = false;
    }
    this.evalCallback = null;
    this.bestMoveCallback = null;
  }

  public newGame() {
    this.stop();
    this.worker.postMessage("ucinewgame");
    this.worker.postMessage("isready");
  }

  public terminate() {
    this.stop();
    this.worker.terminate();
  }
}

export const gameEngine = new StockfishEngine();
export const analysisEngine = new StockfishEngine();

import { Game } from "../core/Game";
import { gameEngine, analysisEngine, EngineDifficulty, EvaluationData } from "../services/engineService";
import { playSound } from "../services/audio";

export class AIGameController {
  private game: Game;
  private difficulty: EngineDifficulty;
  private playerColor: "white" | "black";
  private onStateChange: () => void;
  public moveQualities: Record<string, string> = {}; // sq -> quality label
  
  private preMoveEval: EvaluationData | null = null;
  private preBestMove: string | null = null;
  
  constructor(
    game: Game,
    difficulty: EngineDifficulty,
    playerColor: "white" | "black",
    onStateChange: () => void
  ) {
    this.game = game;
    this.difficulty = difficulty;
    this.playerColor = playerColor;
    this.onStateChange = onStateChange;
    
    gameEngine.newGame();
    analysisEngine.newGame();
  }

  public startGame() {
    this.moveQualities = {};
    if (this.game.turn !== this.playerColor) {
      this.makeAIMove();
    } else {
      this.startPlayerAnalysis();
    }
  }

  private startPlayerAnalysis() {
    this.preMoveEval = null;
    this.preBestMove = null;
    analysisEngine.findBestMove(this.game.fen(), "expert", (bestMove) => {
      this.preBestMove = bestMove;
    }, (data) => {
      this.preMoveEval = data;
    });
  }

  public async handlePlayerMove(from: string, to: string, promotion: any = "queen") {
    if (this.game.turn !== this.playerColor) return false;
    
    analysisEngine.stop();
    this.moveQualities = {}; // Clear old labels before calculating new ones
    
    const uciMove = from + to + (promotion === "queen" ? "" : promotion);
    const preBestUci = this.preBestMove;
    const preEval = this.preMoveEval;
    
    const boardBefore = this.game.getBoardState();
    const isCapture = !!boardBefore[to];
    
    const success = this.game.move(from, to, promotion);
    if (!success) {
      this.startPlayerAnalysis(); // Restart analysis if move was invalid
      return false;
    }
    
    if (this.game.isInCheck(this.game.turn)) playSound("check");
    else if (isCapture) playSound("capture");
    else playSound("move");

    this.onStateChange();

    const postMoveFen = this.game.fen();
    let qualityCalculated = false;
    let latestData: EvaluationData | null = null;

    const finalizeQuality = () => {
      if (!qualityCalculated && latestData && preEval) {
        qualityCalculated = true;
        this.calculateMoveQuality(to, uciMove, preBestUci, preEval, latestData);
        this.onStateChange();
      }
    };

    if (this.game.getGameState() === "playing") {
      // 1. Evaluate player's move using full-strength analysis engine
      analysisEngine.evaluatePosition(postMoveFen, (data) => {
        latestData = data;
        if (!qualityCalculated && data.depth >= 8) {
          finalizeQuality();
          analysisEngine.stop(); // free CPU for gameEngine
        }
      });

      // 2. Concurrently start AI response
      gameEngine.findBestMove(postMoveFen, this.difficulty, (bestMove) => {
        finalizeQuality(); // Ensure we calculate quality if depth 8 wasn't reached
        
        if (!bestMove || bestMove.length < 4) return;
        
        const aiFrom = bestMove.substring(0, 2);
        const aiTo = bestMove.substring(2, 4);
        const aiPromo = bestMove.length > 4 ? bestMove[4] : "queen";

        const aiCapture = !!this.game.getBoardState()[aiTo];
        this.game.move(aiFrom, aiTo, aiPromo as any);
        
        if (this.game.isInCheck(this.game.turn)) playSound("check");
        else if (aiCapture) playSound("capture");
        else playSound("move");
        
        this.onStateChange();
        this.startPlayerAnalysis();
      });
    } else {
      // Game over, quickly get an evaluation of the final position
      analysisEngine.evaluatePosition(postMoveFen, (data) => {
        latestData = data;
        if (!qualityCalculated && data.depth >= 8) {
           finalizeQuality();
           analysisEngine.stop();
        }
      });
    }
    
    return true;
  }

  private makeAIMove() {
    gameEngine.findBestMove(this.game.fen(), this.difficulty, (bestMove) => {
      if (!bestMove || bestMove.length < 4) return;
      
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : "queen";

      const isCapture = !!this.game.getBoardState()[to];
      
      this.game.move(from, to, promotion as any);
      
      if (this.game.isInCheck(this.game.turn)) playSound("check");
      else if (isCapture) playSound("capture");
      else playSound("move");
      
      this.onStateChange();
      this.startPlayerAnalysis();
    });
  }

  private calculateMoveQuality(
    square: string,
    playedUci: string,
    bestUci: string | null,
    pre: EvaluationData | null,
    post: EvaluationData
  ) {
    if (!pre) return;
    
    if (bestUci && playedUci === bestUci) {
      this.moveQualities[square] = "Best";
      return;
    }
    
    // Normalize evaluations to the player's perspective
    let preScore = pre.mate !== null ? (pre.mate > 0 ? 100 : -100) : pre.score;
    let postScore = post.mate !== null ? (post.mate > 0 ? -100 : 100) : -post.score;
    
    let diff = postScore - preScore;

    // Handle mates
    if (pre.mate !== null) {
      if (pre.mate > 0) { // Player had forced mate
        if (post.mate === null || post.mate > 0) {
          this.moveQualities[square] = "Blunder";
        } else {
          this.moveQualities[square] = "Excellent";
        }
      } else { // Player was getting mated
        this.moveQualities[square] = "Good";
      }
      return;
    } else if (post.mate !== null) {
      if (post.mate > 0) { // Opponent now has forced mate
        this.moveQualities[square] = "Blunder";
      } else { // Player found a forced mate
        this.moveQualities[square] = "Great";
      }
      return;
    }

    if (diff > -0.2) this.moveQualities[square] = "Excellent";
    else if (diff > -0.5) this.moveQualities[square] = "Good";
    else if (diff > -1.0) this.moveQualities[square] = "Inaccuracy";
    else if (diff > -2.0) this.moveQualities[square] = "Mistake";
    else this.moveQualities[square] = "Blunder";
  }

  public stop() {
    gameEngine.stop();
    analysisEngine.stop();
  }
}

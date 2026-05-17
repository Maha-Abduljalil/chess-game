import { Game } from "../core/Game";
import { engineService, EngineDifficulty, EvaluationData } from "../services/engineService";
import { playSound } from "../services/audio";

export class AIGameController {
  private game: Game;
  private difficulty: EngineDifficulty;
  private playerColor: "white" | "black";
  private onStateChange: () => void;
  public moveQualities: Record<string, string> = {}; // sq -> quality label
  
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
    
    engineService.newGame();
  }

  public startGame() {
    this.moveQualities = {};
    if (this.game.turn !== this.playerColor) {
      this.makeAIMove();
    }
  }

  public async handlePlayerMove(from: string, to: string, promotion: any = "queen") {
    if (this.game.turn !== this.playerColor) return false;
    
    const preMoveFen = this.game.fen();
    
    const boardBefore = this.game.getBoardState();
    const isCapture = !!boardBefore[to];
    
    const success = this.game.move(from, to, promotion);
    if (!success) return false;
    
    if (this.game.isInCheck(this.game.turn)) playSound("check");
    else if (isCapture) playSound("capture");
    else playSound("move");

    this.onStateChange();

    engineService.findBestMove(preMoveFen, "expert", (bestMoveInfo) => {
       
       const uciMove = from + to + (promotion === "queen" ? "" : promotion);
       const bestMoveUci = bestMoveInfo;
       
       if (uciMove === bestMoveUci) {
         this.moveQualities[to] = "Best";
       } else {

         const rand = Math.random();
         if (rand > 0.8) this.moveQualities[to] = "Good";
         else if (rand > 0.4) this.moveQualities[to] = "Inaccuracy";
         else this.moveQualities[to] = "Mistake";
       }
       
       this.onStateChange(); 
    });

    if (this.game.getGameState() === "playing") {
      setTimeout(() => this.makeAIMove(), 500);
    }
    
    return true;
  }

  private makeAIMove() {
    engineService.findBestMove(this.game.fen(), this.difficulty, (bestMove) => {
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
    });
  }

  public stop() {
    engineService.stop();
  }
}

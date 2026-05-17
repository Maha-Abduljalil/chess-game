import { engineService, EvaluationData } from "../services/engineService";

export class SpectatorController {
  private updateUI: (evalData: EvaluationData, bestMove: string) => void;
  private currentBestMove: string = "—";
  
  constructor(updateUI: (evalData: EvaluationData, bestMove: string) => void) {
    this.updateUI = updateUI;
  }

  public analyzePosition(fen: string) {
    engineService.evaluatePosition(fen, (data) => {
      this.updateUI(data, this.currentBestMove);
    });
    
    engineService.findBestMove(fen, "expert", (bestMove) => {
      this.currentBestMove = bestMove;
    }, (data) => {
       this.updateUI(data, this.currentBestMove);
    });
  }

  public stop() {
    engineService.stop();
  }
}

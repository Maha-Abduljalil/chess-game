import { Chess } from "chess.js";
import type { BoardState } from "./Board";
import type { PieceColor, PieceType } from "./Piece";

export type GameStatus = "playing" | "checkmate" | "stalemate" | "draw" | "waiting";

export class Game {
  chess: Chess;
  selectedSquare: string | null;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
    this.selectedSquare = null;
  }

  get turn(): PieceColor {
    return this.chess.turn() === "w" ? "white" : "black";
  }

  load(fen: string) {
    this.chess.load(fen);
  }

  fen(): string {
    return this.chess.fen();
  }

  getBoardState(): BoardState {
    const boardState: BoardState = {};
    const chessBoard = this.chess.board(); 

    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const sq = files[j] + ranks[i];
        const piece = chessBoard[i][j];
        if (piece) {
          boardState[sq] = {
            type: this.mapType(piece.type),
            color: piece.color === "w" ? "white" : "black",
          };
        } else {
          boardState[sq] = null;
        }
      }
    }
    return boardState;
  }

  private mapType(type: string): PieceType {
    const map: Record<string, PieceType> = {
      p: "pawn",
      n: "knight",
      b: "bishop",
      r: "rook",
      q: "queen",
      k: "king",
    };
    return map[type];
  }

  getPiece(square: string) {
    const piece = this.chess.get(square as any);
    if (!piece) return null;
    return {
      type: this.mapType(piece.type),
      color: piece.color === "w" ? "white" : "black",
    };
  }

  selectSquare(square: string) {
    const piece = this.chess.get(square as any);
    if (piece && (piece.color === "w" ? "white" : "black") === this.turn) {
      this.selectedSquare = square;
      return true;
    }
    return false;
  }

  clearSelection() {
    this.selectedSquare = null;
  }

  isOwnPiece(square: string) {
    const piece = this.chess.get(square as any);
    return Boolean(piece && (piece.color === "w" ? "white" : "black") === this.turn);
  }

  getGameState(): GameStatus {
    if (this.chess.isCheckmate()) return "checkmate";
    if (this.chess.isStalemate()) return "stalemate";
    if (this.chess.isDraw()) return "draw";
    return "playing";
  }

  move(from: string, to: string, promotionType: PieceType = "queen") {
    try {
      const pType = promotionType === "knight" ? "n" : promotionType.charAt(0);
      const move = this.chess.move({
        from: from,
        to: to,
        promotion: pType as any,
      });
      if (move) {
        this.selectedSquare = null;
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  getLegalMoves(square: string): string[] {
    try {
      const moves = this.chess.moves({ square: square as any, verbose: true });
      return moves.map((m) => m.to);
    } catch (e) {
      return [];
    }
  }

  isInCheck(color: PieceColor): boolean {
    if (color === this.turn) {
      return this.chess.inCheck();
    }
    return false;
  }
}
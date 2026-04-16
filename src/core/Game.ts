import { Board } from "./Board";
import type { PieceColor } from "./Piece";
import { oppositeColor } from "./Piece";

export class Game {
  board: Board;
  turn: PieceColor;
  selectedSquare: string | null;

  constructor() {
    this.board = Board.startingBoard();
    this.turn = "white";
    this.selectedSquare = null;
  }

  getBoardState() {
    return this.board.snapshot();
  }

  getPiece(square: string) {
    return this.board.getPiece(square);
  }

  selectSquare(square: string) {
    const piece = this.board.getPiece(square);
    if (piece && piece.color === this.turn) {
      this.selectedSquare = square;
      return true;
    }
    return false;
  }

  clearSelection() {
    this.selectedSquare = null;
  }

  isOwnPiece(square: string) {
    const piece = this.getPiece(square);
    return Boolean(piece && piece.color === this.turn);
  }

  move(from: string, to: string) {
    if (!this.isValidMove(from, to)) return false;

    const piece = this.board.getPiece(from);
    if (!piece || piece.color !== this.turn) return false;

    this.board.movePiece(from, to);
    this.turn = oppositeColor(this.turn);
    this.selectedSquare = null;

    return true;
  }

  isValidMove(from: string, to: string): boolean {
    const piece = this.board.getPiece(from);
    if (!piece || piece.color !== this.turn) return false;
    if (from === to) return false;
    const toPiece = this.board.getPiece(to);
    if (toPiece && toPiece.color === piece.color) return false; // can't capture own piece

    switch (piece.type) {
      case 'pawn':
        return this.isValidPawnMove(from, to, piece.color);
      case 'rook':
        return this.isValidRookMove(from, to);
      case 'bishop':
        return this.isValidBishopMove(from, to);
      case 'queen':
        return this.isValidQueenMove(from, to);
      case 'king':
        return this.isValidKingMove(from, to);
      case 'knight':
        return this.isValidKnightMove(from, to);
      default:
        return false;
    }
  }

  isValidPawnMove(from: string, to: string, color: PieceColor): boolean {
    const fromFile = Board.getFile(from);
    const fromRank = Board.getRank(from);
    const toFile = Board.getFile(to);
    const toRank = Board.getRank(to);
    const toPiece = this.board.getPiece(to);
    const direction = color === 'white' ? 1 : -1;
    const startRank = color === 'white' ? 2 : 7;

    // move forward
    if (fromFile === toFile && !toPiece) {
      if (toRank === fromRank + direction) return true;
      if (fromRank === startRank && toRank === fromRank + 2 * direction && !this.board.getPiece(fromFile + (fromRank + direction))) return true;
    }

    // capture
    if (Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0)) === 1 && toRank === fromRank + direction && toPiece && toPiece.color !== color) return true;

    return false;
  }

  isValidRookMove(from: string, to: string): boolean {
    const fromFile = Board.getFile(from);
    const fromRank = Board.getRank(from);
    const toFile = Board.getFile(to);
    const toRank = Board.getRank(to);

    if (fromFile === toFile) {
      // vertical
      const minRank = Math.min(fromRank, toRank);
      const maxRank = Math.max(fromRank, toRank);
      for (let r = minRank + 1; r < maxRank; r++) {
        if (this.board.getPiece(fromFile + r)) return false;
      }
      return true;
    } else if (fromRank === toRank) {
      // horizontal
      const files = 'abcdefgh';
      const fromIndex = files.indexOf(fromFile);
      const toIndex = files.indexOf(toFile);
      const minIndex = Math.min(fromIndex, toIndex);
      const maxIndex = Math.max(fromIndex, toIndex);
      for (let i = minIndex + 1; i < maxIndex; i++) {
        if (this.board.getPiece(files[i] + fromRank)) return false;
      }
      return true;
    }
    return false;
  }

  isValidBishopMove(from: string, to: string): boolean {
    const fromFile = Board.getFile(from);
    const fromRank = Board.getRank(from);
    const toFile = Board.getFile(to);
    const toRank = Board.getRank(to);
    const fileDiff = Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0));
    const rankDiff = Math.abs(fromRank - toRank);
    if (fileDiff !== rankDiff) return false;

    const fileDir = toFile > fromFile ? 1 : -1;
    const rankDir = toRank > fromRank ? 1 : -1;
    let f = fromFile.charCodeAt(0) + fileDir;
    let r = fromRank + rankDir;
    while (f !== toFile.charCodeAt(0) || r !== toRank) {
      if (this.board.getPiece(String.fromCharCode(f) + r)) return false;
      f += fileDir;
      r += rankDir;
    }
    return true;
  }

  isValidQueenMove(from: string, to: string): boolean {
    return this.isValidRookMove(from, to) || this.isValidBishopMove(from, to);
  }

  isValidKingMove(from: string, to: string): boolean {
    const fromFile = Board.getFile(from);
    const fromRank = Board.getRank(from);
    const toFile = Board.getFile(to);
    const toRank = Board.getRank(to);
    const fileDiff = Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0));
    const rankDiff = Math.abs(fromRank - toRank);
    return fileDiff <= 1 && rankDiff <= 1 && (fileDiff > 0 || rankDiff > 0);
  }

  isValidKnightMove(from: string, to: string): boolean {
    const fromFile = Board.getFile(from);
    const fromRank = Board.getRank(from);
    const toFile = Board.getFile(to);
    const toRank = Board.getRank(to);
    const fileDiff = Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0));
    const rankDiff = Math.abs(fromRank - toRank);
    return (fileDiff === 1 && rankDiff === 2) || (fileDiff === 2 && rankDiff === 1);
  }
}
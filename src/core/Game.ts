import { Board, FILES, RANKS } from "./Board";
import type { EnPassantTarget } from "./Board";
import type { PieceColor, PieceType } from "./Piece";
import { oppositeColor } from "./Piece";

export type GameStatus = "playing" | "checkmate" | "stalemate" | "draw" | "waiting";

export class Game {
  board: Board;
  turn: PieceColor;
  selectedSquare: string | null;

  constructor(board?: Board, turn?: PieceColor) {
    this.board = board || Board.startingBoard();
    this.turn = turn || "white";
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

  /** Gets the overall game state based on legal moves available */
  getGameState(): GameStatus {
    const hasLegalMoves = this.hasAnyLegalMove(this.turn);
    const inCheck = this.isInCheck(this.turn);

    if (inCheck && !hasLegalMoves) return "checkmate";
    if (!inCheck && !hasLegalMoves) return "stalemate";
    
    // For simplicity, we omit 50-move rule and 3-fold repetition for now
    return "playing";
  }

  /** Move logic that validates legality (including check rules) and handles special moves */
  move(from: string, to: string, promotionType: PieceType = "queen") {
    if (!this.isLegalMove(from, to)) return false;

    const piece = this.board.getPiece(from);
    if (!piece || piece.color !== this.turn) return false;

    // Handle En Passant Capture
    if (piece.type === "pawn" && this.board.enPassantTarget && to === this.board.enPassantTarget.square) {
      this.board.setPiece(this.board.enPassantTarget.pawnSquare, null); // remove captured pawn
    }

    // Set En Passant Target for the next turn if it's a double pawn push
    let nextEnPassantTarget: EnPassantTarget | null = null;
    if (piece.type === "pawn" && Math.abs(Board.getRank(from) - Board.getRank(to)) === 2) {
      const file = Board.getFile(from);
      const passedRank = (Board.getRank(from) + Board.getRank(to)) / 2;
      nextEnPassantTarget = {
        square: file + passedRank,
        pawnSquare: to
      };
    }

    // Handle Castling
    if (piece.type === "king" && Math.abs(Board.fileIndex(Board.getFile(from)) - Board.fileIndex(Board.getFile(to))) > 1) {
      const rank = Board.getRank(from);
      if (to === `g${rank}`) {
        // Kingside
        this.board.movePiece(`h${rank}`, `f${rank}`);
      } else if (to === `c${rank}`) {
        // Queenside
        this.board.movePiece(`a${rank}`, `d${rank}`);
      }
    }

    // Update Castle Flags
    this.updateCastleFlags(from, piece);

    // Apply the main move
    this.board.movePiece(from, to);

    // Handle Promotion
    if (piece.type === "pawn" && (Board.getRank(to) === 1 || Board.getRank(to) === 8)) {
      this.board.setPiece(to, { type: promotionType, color: piece.color });
    }

    // Finalize Turn
    this.board.enPassantTarget = nextEnPassantTarget;
    this.turn = oppositeColor(this.turn);
    this.selectedSquare = null;

    return true;
  }

  private updateCastleFlags(from: string, piece: { type: PieceType; color: PieceColor }) {
    if (piece.type === "king") {
      if (piece.color === "white") this.board.castleFlags.whiteKingMoved = true;
      else this.board.castleFlags.blackKingMoved = true;
    } else if (piece.type === "rook") {
      if (from === "a1") this.board.castleFlags.whiteRookAMoved = true;
      else if (from === "h1") this.board.castleFlags.whiteRookHMoved = true;
      else if (from === "a8") this.board.castleFlags.blackRookAMoved = true;
      else if (from === "h8") this.board.castleFlags.blackRookHMoved = true;
    }
  }

  /** Gets all legal moves for a given square */
  getLegalMoves(square: string): string[] {
    const piece = this.board.getPiece(square);
    if (!piece || piece.color !== this.turn) return [];

    const moves: string[] = [];
    for (const f of FILES) {
      for (const r of RANKS) {
        const to = f + r;
        if (this.isLegalMove(square, to)) {
          moves.push(to);
        }
      }
    }
    return moves;
  }

  /** Returns true if ANY legal move exists for the given color */
  hasAnyLegalMove(color: PieceColor): boolean {
    for (const f of FILES) {
      for (const r of RANKS) {
        const sq = f + r;
        const p = this.board.getPiece(sq);
        if (p && p.color === color) {
          // Temporarily set turn to test moves (in case we're testing the opponent)
          const originalTurn = this.turn;
          this.turn = color;
          
          for (const tf of FILES) {
            for (const tr of RANKS) {
              const to = tf + tr;
              if (this.isLegalMove(sq, to)) {
                this.turn = originalTurn;
                return true;
              }
            }
          }
          this.turn = originalTurn;
        }
      }
    }
    return false;
  }

  /** Core validation: Pseudo-legal + King safety */
  isLegalMove(from: string, to: string): boolean {
    if (!this.isValidPseudoMove(from, to)) return false;
    return !this.wouldBeInCheckAfterMove(from, to);
  }

  /** Validates basic piece movement rules without checking king safety */
  isValidPseudoMove(from: string, to: string): boolean {
    const piece = this.board.getPiece(from);
    if (!piece || piece.color !== this.turn) return false;
    if (from === to) return false;
    const toPiece = this.board.getPiece(to);
    if (toPiece && toPiece.color === piece.color) return false; // can't capture own piece

    switch (piece.type) {
      case 'pawn': return this.isValidPawnMove(from, to, piece.color);
      case 'rook': return this.isValidRookMove(from, to);
      case 'bishop': return this.isValidBishopMove(from, to);
      case 'queen': return this.isValidQueenMove(from, to);
      case 'king': return this.isValidKingMove(from, to);
      case 'knight': return this.isValidKnightMove(from, to);
      default: return false;
    }
  }

  wouldBeInCheckAfterMove(from: string, to: string): boolean {
    const simulatedBoard = this.board.clone();
    const simGame = new Game(simulatedBoard, this.turn);

    const piece = simGame.board.getPiece(from)!;
    
    // Simulate En Passant Capture
    if (piece.type === "pawn" && simGame.board.enPassantTarget && to === simGame.board.enPassantTarget.square) {
      simGame.board.setPiece(simGame.board.enPassantTarget.pawnSquare, null);
    }
    
    // Simulate basic move
    simGame.board.movePiece(from, to);

    // After move, check if the player who just moved is in check
    return simGame.isInCheck(this.turn);
  }

  isInCheck(color: PieceColor): boolean {
    let kingSquare: string | null = null;
    
    // Find King
    for (const f of FILES) {
      for (const r of RANKS) {
        const sq = f + r;
        const p = this.board.getPiece(sq);
        if (p && p.type === "king" && p.color === color) {
          kingSquare = sq;
          break;
        }
      }
      if (kingSquare) break;
    }

    if (!kingSquare) return false; // Should not happen in a valid game

    // Check if any opponent piece can attack the king
    const oppColor = oppositeColor(color);
    
    // We create a temporary game instance with the turn set to the opponent 
    // to reuse pseudo-legal move validation logic
    const tempGame = new Game(this.board, oppColor);

    for (const f of FILES) {
      for (const r of RANKS) {
        const sq = f + r;
        const p = this.board.getPiece(sq);
        if (p && p.color === oppColor) {
          if (tempGame.isValidPseudoMove(sq, kingSquare)) {
            return true;
          }
        }
      }
    }

    return false;
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

    // normal capture
    if (Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0)) === 1 && toRank === fromRank + direction) {
      if (toPiece && toPiece.color !== color) return true;
      // en passant
      if (this.board.enPassantTarget && to === this.board.enPassantTarget.square) return true;
    }

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
      const fromIndex = Board.fileIndex(fromFile);
      const toIndex = Board.fileIndex(toFile);
      const minIndex = Math.min(fromIndex, toIndex);
      const maxIndex = Math.max(fromIndex, toIndex);
      for (let i = minIndex + 1; i < maxIndex; i++) {
        if (this.board.getPiece(FILES[i] + fromRank)) return false;
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
    
    // Normal Move
    if (fileDiff <= 1 && rankDiff <= 1 && (fileDiff > 0 || rankDiff > 0)) {
      return true;
    }

    // Castling
    if (rankDiff === 0 && fileDiff === 2) {
      if (this.isInCheck(this.turn)) return false;

      const isWhite = this.turn === "white";
      const rank = isWhite ? 1 : 8;
      if (fromRank !== rank) return false;

      const flags = this.board.castleFlags;
      const kingMoved = isWhite ? flags.whiteKingMoved : flags.blackKingMoved;
      if (kingMoved) return false;

      if (toFile === "g") {
        // Kingside
        const rookMoved = isWhite ? flags.whiteRookHMoved : flags.blackRookHMoved;
        if (rookMoved) return false;
        
        // Check for pieces in between
        if (this.board.getPiece(`f${rank}`) || this.board.getPiece(`g${rank}`)) return false;
        
        // Cannot pass through check
        if (this.wouldBeInCheckAfterMove(from, `f${rank}`)) return false;
        
        return true;
      } else if (toFile === "c") {
        // Queenside
        const rookMoved = isWhite ? flags.whiteRookAMoved : flags.blackRookAMoved;
        if (rookMoved) return false;

        // Check for pieces in between
        if (this.board.getPiece(`b${rank}`) || this.board.getPiece(`c${rank}`) || this.board.getPiece(`d${rank}`)) return false;

        // Cannot pass through check
        if (this.wouldBeInCheckAfterMove(from, `d${rank}`)) return false;

        return true;
      }
    }

    return false;
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
import type { Piece } from "./Piece";

export type BoardState = Record<string, Piece | null>;

/** Tracks which castling-relevant pieces have moved */
export interface CastleFlags {
  whiteKingMoved: boolean;
  whiteRookAMoved: boolean; // a1
  whiteRookHMoved: boolean; // h1
  blackKingMoved: boolean;
  blackRookAMoved: boolean; // a8
  blackRookHMoved: boolean; // h8
}

/** Info needed for en passant detection on the next move */
export interface EnPassantTarget {
  square: string;   // the square the capturing pawn moves TO (the "ghost" square)
  pawnSquare: string; // the actual square the double-pushed pawn sits on
}

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export class Board {
  state: BoardState;
  castleFlags: CastleFlags;
  enPassantTarget: EnPassantTarget | null;

  constructor(
    state?: BoardState,
    castleFlags?: CastleFlags,
    enPassantTarget?: EnPassantTarget | null
  ) {
    this.state = state ? { ...state } : Board.emptyState();
    this.castleFlags = castleFlags
      ? { ...castleFlags }
      : {
          whiteKingMoved: false,
          whiteRookAMoved: false,
          whiteRookHMoved: false,
          blackKingMoved: false,
          blackRookAMoved: false,
          blackRookHMoved: false,
        };
    this.enPassantTarget = enPassantTarget ? { ...enPassantTarget } : null;
  }

  /** Deep clone — copies board state, castle flags, and en passant target */
  clone(): Board {
    const clonedState: BoardState = {};
    for (const sq of Object.keys(this.state)) {
      const p = this.state[sq];
      clonedState[sq] = p ? { ...p } : null;
    }
    return new Board(clonedState, { ...this.castleFlags }, this.enPassantTarget ? { ...this.enPassantTarget } : null);
  }

  static getFile(square: string): string {
    return square[0];
  }

  static getRank(square: string): number {
    return parseInt(square[1]);
  }

  static isValidSquare(square: string): boolean {
    return /^[a-h][1-8]$/.test(square);
  }

  static toSquare(fileIndex: number, rank: number): string {
    return FILES[fileIndex] + rank;
  }

  static fileIndex(file: string): number {
    return file.charCodeAt(0) - "a".charCodeAt(0);
  }

  static emptyState(): BoardState {
    const state: BoardState = {};
    for (const rank of RANKS) {
      for (const file of FILES) {
        state[`${file}${rank}`] = null;
      }
    }
    return state;
  }

  static startingBoard(): Board {
    const board = new Board();
    const placement: Array<[string, Piece]> = [
      ["a1", { type: "rook", color: "white" }],
      ["b1", { type: "knight", color: "white" }],
      ["c1", { type: "bishop", color: "white" }],
      ["d1", { type: "queen", color: "white" }],
      ["e1", { type: "king", color: "white" }],
      ["f1", { type: "bishop", color: "white" }],
      ["g1", { type: "knight", color: "white" }],
      ["h1", { type: "rook", color: "white" }],
      ["a2", { type: "pawn", color: "white" }],
      ["b2", { type: "pawn", color: "white" }],
      ["c2", { type: "pawn", color: "white" }],
      ["d2", { type: "pawn", color: "white" }],
      ["e2", { type: "pawn", color: "white" }],
      ["f2", { type: "pawn", color: "white" }],
      ["g2", { type: "pawn", color: "white" }],
      ["h2", { type: "pawn", color: "white" }],
      ["a8", { type: "rook", color: "black" }],
      ["b8", { type: "knight", color: "black" }],
      ["c8", { type: "bishop", color: "black" }],
      ["d8", { type: "queen", color: "black" }],
      ["e8", { type: "king", color: "black" }],
      ["f8", { type: "bishop", color: "black" }],
      ["g8", { type: "knight", color: "black" }],
      ["h8", { type: "rook", color: "black" }],
      ["a7", { type: "pawn", color: "black" }],
      ["b7", { type: "pawn", color: "black" }],
      ["c7", { type: "pawn", color: "black" }],
      ["d7", { type: "pawn", color: "black" }],
      ["e7", { type: "pawn", color: "black" }],
      ["f7", { type: "pawn", color: "black" }],
      ["g7", { type: "pawn", color: "black" }],
      ["h7", { type: "pawn", color: "black" }],
    ];

    for (const [square, piece] of placement) {
      board.state[square] = piece;
    }

    return board;
  }

  getPiece(square: string): Piece | null {
    return this.state[square] ?? null;
  }

  setPiece(square: string, piece: Piece | null): void {
    if (!(square in this.state)) {
      throw new Error(`Invalid square ${square}`);
    }
    this.state[square] = piece;
  }

  movePiece(from: string, to: string): Piece | null {
    const piece = this.getPiece(from);
    if (!piece) {
      throw new Error(`No piece at ${from}`);
    }
    const captured = this.getPiece(to);
    this.setPiece(to, piece);
    this.setPiece(from, null);
    return captured;
  }

  snapshot(): BoardState {
    return { ...this.state };
  }
}

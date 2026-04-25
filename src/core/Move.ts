import type { Piece, PieceType } from "./Piece";

export interface Move {
  from: string;
  to: string;
  piece: Piece;
  captured: Piece | null;
  timestamp: number;
  promotion?: PieceType;
  isCastling?: boolean;
  isEnPassant?: boolean;
}

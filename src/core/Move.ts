import type { Piece } from "./Piece";

export interface Move {
  from: string;
  to: string;
  piece: Piece;
  captured: Piece | null;
  timestamp: number;
}

export type PieceColor = "white" | "black";
export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export function oppositeColor(color: PieceColor): PieceColor {
  return color === "white" ? "black" : "white";
}
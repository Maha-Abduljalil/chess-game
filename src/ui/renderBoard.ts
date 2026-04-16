import type { BoardState } from "../core/Board";
import type { PieceColor, PieceType } from "../core/Piece";

export interface RenderOptions {
  validMoves?: string[];
  lastMove?: { from: string; to: string } | null;
  inCheck?: string | null;
}

export function renderBoard(
  container: HTMLElement,
  board: BoardState,
  selected: string | null,
  onClick: (sq: string) => void,
  options: RenderOptions = {}
) {
  container.innerHTML = "";
  container.className = "chess-board";

  const files = ["a","b","c","d","e","f","g","h"];
  const ranks = ["8","7","6","5","4","3","2","1"];

  const validSet = new Set(options.validMoves ?? []);
  const lastFrom = options.lastMove?.from ?? null;
  const lastTo = options.lastMove?.to ?? null;

  for (const r of ranks) {
    for (const f of files) {
      const sq = f + r;
      const isLight = (files.indexOf(f) + ranks.indexOf(r)) % 2 === 0;

      const cell = document.createElement("div");

      const classes = ["square", isLight ? "light" : "dark"];
      if (sq === selected) classes.push("selected");
      if (sq === lastFrom || sq === lastTo) classes.push("last-move");
      if (sq === options.inCheck) classes.push("in-check");
      if (validSet.has(sq)) {
        const targetPiece = board[sq];
        classes.push(targetPiece ? "valid-capture" : "valid-move");
      }

      cell.className = classes.join(" ");
      cell.onclick = () => onClick(sq);

      const piece = board[sq];
     if (piece) {
  const span = document.createElement("span");
  span.textContent = getSymbol(piece.color, piece.type);
  span.className = "piece-symbol " + piece.color; 
  cell.appendChild(span);
}

      container.appendChild(cell);
    }
  }
}

const symbols: Record<PieceColor, Record<PieceType, string>> = {
  white: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  black: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" }
};

function getSymbol(color: PieceColor, type: PieceType): string {
  return symbols[color][type];
}

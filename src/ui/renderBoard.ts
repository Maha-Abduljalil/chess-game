import type { BoardState } from "../core/Board";
import type { PieceColor, PieceType } from "../core/Piece";

export interface RenderOptions {
  validMoves?: string[];
  lastMove?: { from: string; to: string } | null;
  inCheck?: string | null;
  orientation?: "white" | "black";
  moveQualities?: Record<string, string>;
}

export function renderBoard(
  container: HTMLElement,
  board: BoardState,
  selected: string | null,
  onClick: (sq: string) => void,
  options: RenderOptions = {}
) {
  const isSetup = container.children.length === 64;
  if (!isSetup) {
    container.innerHTML = "";
    container.className = "chess-board";
  }

  const flipped = (options.orientation ?? "white") === "black";
  const files = flipped
    ? ["h","g","f","e","d","c","b","a"]
    : ["a","b","c","d","e","f","g","h"];
  const ranks = flipped
    ? ["1","2","3","4","5","6","7","8"]
    : ["8","7","6","5","4","3","2","1"];

  const validSet = new Set(options.validMoves ?? []);
  const lastFrom = options.lastMove?.from ?? null;
  const lastTo = options.lastMove?.to ?? null;

  let cellIndex = 0;

  for (const r of ranks) {
    for (const f of files) {
      const sq = f + r;
      const isLight = (files.indexOf(f) + ranks.indexOf(r)) % 2 === 0;

      let cell: HTMLElement;
      if (isSetup) {
        cell = container.children[cellIndex] as HTMLElement;
      } else {
        cell = document.createElement("div");
        container.appendChild(cell);
      }

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
      let img = cell.querySelector(".piece-img") as HTMLImageElement;

      if (piece) {
        const expectedSrc = getPieceImageUrl(piece.color, piece.type);
        if (!img) {
          img = document.createElement("img");
          img.className = "piece-img";
          img.draggable = false;
          img.src = expectedSrc;
          img.alt = `${piece.color} ${piece.type}`;
          cell.appendChild(img);
        } else {
          const currentSrc = img.getAttribute("src") || "";
          if (currentSrc !== expectedSrc && !currentSrc.endsWith(expectedSrc)) {
            img.src = expectedSrc;
            img.alt = `${piece.color} ${piece.type}`;
          }
        }
      } else if (img) {
        img.remove();
      }

      let badge = cell.querySelector(".move-quality") as HTMLElement;
      if (options.moveQualities && options.moveQualities[sq]) {
        const quality = options.moveQualities[sq];
        if (!badge) {
          badge = document.createElement("div");
          cell.appendChild(badge);
        }
        badge.className = `move-quality quality-${quality.toLowerCase()}`;
        badge.textContent = quality;
      } else if (badge) {
        badge.remove();
      }

      cellIndex++;
    }
  }
}

function getPieceImageUrl(color: PieceColor, type: PieceType): string {
  const c = color === "white" ? "w" : "b";
  const t = type === "knight" ? "N" : type.charAt(0).toUpperCase();
  return `/pieces/${c}${t}.svg`;
}

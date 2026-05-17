import { db } from "./firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  getDoc,
  runTransaction,
} from "firebase/firestore";
import { Chess } from "chess.js";

export interface TimeControl {
  initialMs: number;
  incrementMs: number;
}

export type GameDocument = {
  players: {
    white: string;
    black: string | null;
  };
  fen: string;
  turn: "white" | "black";
  status: "waiting" | "playing" | "checkmate" | "stalemate" | "draw" | "timeout";
  winner?: string;
  timeControl: TimeControl;
  timers: { white: number; black: number };
  timerStartedAt: number; 
};

const gamesCollection = collection(db, "games");

export async function createGame(
  userId: string,
  timeControl: TimeControl = { initialMs: 600_000, incrementMs: 0 }
) {
  if (!userId) {
    throw new Error("Cannot create game: No User ID provided.");
  }

  const chess = new Chess();

  try {
    const docRef = await addDoc(gamesCollection, {
      players: { white: userId, black: null },
      fen: chess.fen(),
      turn: "white",
      status: "waiting",
      timeControl,
      timers: { white: timeControl.initialMs, black: timeControl.initialMs },
      timerStartedAt: 0, 
    });

    return docRef.id;
  } catch (error) {
    console.error("Firestore createGame error:", error);
    throw error;
  }
}

export async function joinGame(gameId: string, userId: string) {
  const ref = doc(db, "games", gameId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) throw new Error("Game not found.");

  const data = snapshot.data() as GameDocument;
  if (data.players.black) throw new Error("This game already has a second player.");

  await updateDoc(ref, {
    "players.black": userId,
    status: "playing",
    timerStartedAt: Date.now(), 
  });
}

export function listenToGame(
  gameId: string,
  callback: (data: GameDocument | null) => void
) {
  const ref = doc(db, "games", gameId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data() as GameDocument) : null);
  });
}

export async function makeMove(
  gameId: string,
  fen: string,
  turn: "white" | "black",
  status: "playing" | "checkmate" | "stalemate" | "draw" | "timeout" = "playing",
  winner?: string,
  timers?: { white: number; black: number },
  timerStartedAt?: number
) {
  const ref = doc(db, "games", gameId);

  const payload: Record<string, unknown> = { fen, turn, status };
  if (winner) payload.winner = winner;
  if (timers) payload.timers = timers;
  if (timerStartedAt !== undefined) payload.timerStartedAt = timerStartedAt;

  await updateDoc(ref, payload);
}

export async function getGame(gameId: string): Promise<GameDocument | null> {
  const ref = doc(db, "games", gameId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as GameDocument) : null;
}


export async function makeTimeoutMove(
  gameId: string,
  losingColor: "white" | "black"
) {
  const ref = doc(db, "games", gameId);
  const winner = losingColor === "white" ? "Black" : "White";

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as GameDocument;

    if (data.status !== "playing") return;

    tx.update(ref, {
      status: "timeout",
      winner,
      turn: losingColor === "white" ? "black" : "white",
    });
  });
}
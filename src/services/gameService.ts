import { db } from "./firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  getDoc
} from "firebase/firestore";
import { Board } from "../core/Board";

export type GameDocument = {
  players: {
    white: string;
    black: string | null;
  };
  board: Record<string, any>;
  turn: "white" | "black";
  status: "waiting" | "playing" | "checkmate" | "stalemate" | "draw";
  winner?: string;
};

const gamesCollection = collection(db, "games");

export async function createGame(userId: string) {
  const startingBoard = Board.startingBoard().snapshot();

  const docRef = await addDoc(gamesCollection, {
    players: {
      white: userId,
      black: null
    },
    board: startingBoard,
    turn: "white",
    status: "waiting"
  });

  return docRef.id;
}

export async function joinGame(gameId: string, userId: string) {
  const ref = doc(db, "games", gameId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Game not found.");
  }

  const data = snapshot.data() as GameDocument;
  if (data.players.black) {
    throw new Error("This game already has a second player.");
  }

  await updateDoc(ref, {
    "players.black": userId,
    status: "playing"
  });
}

export function listenToGame(gameId: string, callback: (data: GameDocument | null) => void) {
  const ref = doc(db, "games", gameId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data() as GameDocument) : null);
  });
}

export async function makeMove(
  gameId: string, 
  board: Record<string, any>, 
  turn: "white" | "black",
  status: "playing" | "checkmate" | "stalemate" | "draw" = "playing",
  winner?: string
) {
  const ref = doc(db, "games", gameId);

  const payload: any = {
    board,
    turn,
    status
  };

  if (winner) {
    payload.winner = winner;
  }

  await updateDoc(ref, payload);
}
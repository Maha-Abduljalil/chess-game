import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  side: "white" | "black" | "spectator";
  text: string;
  timestamp: number;
}

export async function sendChatMessage(
  gameId: string,
  message: Omit<ChatMessage, "id" | "timestamp">
) {
  const chatCollection = collection(db, "games", gameId, "chat");
  await addDoc(chatCollection, {
    ...message,
    timestamp: serverTimestamp(),
  });
}

export function listenToChat(
  gameId: string,
  callback: (messages: ChatMessage[]) => void
) {
  const chatCollection = collection(db, "games", gameId, "chat");
  const q = query(chatCollection, orderBy("timestamp", "asc"));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp)?.toMillis() || Date.now(),
      } as ChatMessage;
    });
    callback(messages);
  });
}

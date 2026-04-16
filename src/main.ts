import "./style.css";
import { loginWithGoogle } from "./services/firebase";
import { initChessUI } from "./ui/events";

initChessUI(loginWithGoogle);
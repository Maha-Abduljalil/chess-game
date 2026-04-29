export const sounds = {
  move: new Audio('/sounds/move.mp3'),
  capture: new Audio('/sounds/capture.mp3'),
  check: new Audio('/sounds/check.mp3'),
  start: new Audio('/sounds/start.mp3'),
  end: new Audio('/sounds/end.mp3')
};

export function playSound(type: keyof typeof sounds) {
  const sound = sounds[type];
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(console.error);
  }
}

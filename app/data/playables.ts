export interface Playable {
  id: string;
  title: string;
  developer: string;
  thumbnail: string;
  iframeUrl: string;
}

export const playables: Playable[] = [
  {
    id: "2048",
    title: "2048",
    developer: "Gabriele Cirulli",
    thumbnail: "https://placehold.co/600x600/2a2a2a/FFF?text=2048&font=montserrat",
    iframeUrl: "https://play2048.co/",
  },
  {
    id: "hextris",
    title: "Hextris",
    developer: "Logan & Garrett",
    thumbnail: "https://placehold.co/600x600/e74c3c/FFF?text=Hextris&font=montserrat",
    iframeUrl: "https://hextris.io/",
  },
  {
    id: "tetris",
    title: "React Tetris",
    developer: "Chvin",
    thumbnail: "https://placehold.co/600x600/2980b9/FFF?text=Tetris&font=montserrat",
    iframeUrl: "https://chvin.github.io/react-tetris/?lan=en",
  },
  {
    id: "chrome-dino",
    title: "Chrome Dino",
    developer: "Chromium Team",
    thumbnail: "https://placehold.co/600x600/95a5a6/FFF?text=Dino&font=montserrat",
    iframeUrl: "https://chromedino.com/",
  },
  {
    id: "flappy-bird",
    title: "Flappy Bird",
    developer: "Dong Nguyen (Clone)",
    thumbnail: "https://placehold.co/600x600/f1c40f/FFF?text=Flappy\nBird&font=montserrat",
    iframeUrl: "https://flappybird.io/",
  },
  {
    id: "pacman",
    title: "Pac-Man",
    developer: "Google (Clone)",
    thumbnail: "https://placehold.co/600x600/f39c12/FFF?text=Pac-Man&font=montserrat",
    iframeUrl: "https://pacman-html5.appspot.com/",
  },
  {
    id: "asteroids",
    title: "Asteroids",
    developer: "Atari (Clone)",
    thumbnail: "https://placehold.co/600x600/111111/FFF?text=Asteroids&font=montserrat",
    iframeUrl: "https://playasteroids.net/",
  },
  {
    id: "snake",
    title: "Classic Snake",
    developer: "Retro",
    thumbnail: "https://placehold.co/600x600/27ae60/FFF?text=Snake&font=montserrat",
    iframeUrl: "https://playsnake.org/",
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    developer: "Microsoft (Clone)",
    thumbnail: "https://placehold.co/600x600/7f8c8d/FFF?text=Minesweeper&font=montserrat",
    iframeUrl: "https://freeminesweeper.org/",
  }
];

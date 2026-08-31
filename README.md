# ROG GRID WARS — v01

TRON-style light-trail battle game starring the **ASUS ROG Gladius III gaming mouse**.
Single-file HTML5 game (`index.html`) — playable on PC in any modern browser.

## 玩法 / How to play

Open `index.html` in a browser (Chrome / Edge / Firefox). Ride your ROG mouse
across the grid, leave a light trail, and make the rival gaming mice crash into
it. Last mouse online wins the round — first to **5** points wins the match.

**Rivals (AI):** Razer DeathAdder V3 · Logitech G Pro X Superlight · SteelSeries Aerox 5

## 操作 / Controls

| Action | ⌨ Keyboard | 🎮 Joystick / Gamepad |
|---|---|---|
| 轉向 Steer | WASD / Arrow keys | Left stick / D-pad |
| 加速 Boost | Shift | RT / RB |
| 開始 Start | Enter / Space | A / Start |
| 暫停 Pause | Esc / P | Start |

## 技術 / Tech notes

- Pure HTML5 Canvas + vanilla JS, no build step, no dependencies.
- Mouse sprites are hot-linked product images from the web (ASUS / Razer /
  Logitech / SteelSeries CDNs) with a neon-silhouette fallback if an image
  fails to load.
- Gamepad support via the standard Gamepad API; sound via WebAudio (no assets).

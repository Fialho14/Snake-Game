# Snake

A polished Snake game built with vanilla HTML, CSS, and JavaScript — no dependencies, no build step, just open and play.

## Features

- **Smooth animations** — interpolated movement with easing between steps
- **AI mode** — pathfinding agent that hunts food while trying to stay alive (BFS + flood-fill safety check)
- **Sound effects** — Web Audio API tones for eating, levelling up, and dying
- **Light / dark theme** — persisted in localStorage
- **Wrap mode** — walk through walls instead of dying
- **Speed control** — Slow / Normal / Fast, each scaling with level
- **Score & best** — best score persisted across sessions
- **Level system** — speed increases every 5 points

## Controls

| Key | Action |
|-----|--------|
| `↑ ↓ ← →` or `W A S D` | Move |
| `Space` | Pause / Resume |

Buttons in the top bar toggle **Sound**, **Dark mode**, **AI**, and **Wrap**.

## How to run

Download or clone the repo, then open `snake.html` in any modern browser — no server needed.

```bash
git clone https://github.com/pedrofialho/snake-game.git
cd snake-game
open snake.html   # macOS
# or just double-click snake.html
```

## Tech

- HTML5 Canvas for rendering
- Web Audio API for sound
- CSS custom properties for theming
- Zero dependencies — single self-contained file

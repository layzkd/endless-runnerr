
# Endless Runner+
A polished HTML5 endless runner with WASD controls, parallax background, coins, obstacles, power‑ups (shield/boost/magnet), pause & mute, score + local high score.

## Play locally
1. Download and extract the ZIP.
2. Open `index.html` in any modern browser.

## Quick deploy to GitHub Pages
1. Create a **public** repo (e.g., `endless-runner-plus`).
2. Upload **these three files at the root**:
   - `index.html`
   - `game.js`
   - `style.css`
3. Go to **Settings → Pages**.
4. Set **Source** to **Deploy from a branch**: branch `main`, folder `/root`. Save.
5. Your link will be: `https://<your-user>.github.io/endless-runner-plus/`.

## Controls
- **W** = Jump
- **S** = Slide
- **A/D** = Move left/right
- **P** = Pause
- **M** = Mute/Unmute
- **R** = Restart

## Notes
- Audio uses the WebAudio API; it will start after your first interaction.
- High score is stored in `localStorage`.

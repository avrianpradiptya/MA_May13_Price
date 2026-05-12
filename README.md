# 🎮 Price is Right — Game Template

## Folder Structure

```
price-is-right/
├── index.html              ← Main game (open this in browser)
├── game.js                 ← Game engine (state, scoring, flow)
├── images/                 ← Product images go here
│   ├── product1.jpg        (800 × 340 px recommended)
│   └── ...
└── minigames/
    ├── multiple-choice.html
    └── shell-game.html
```

---

## How to Customize

### 1. Set number of rounds & questions
In **`index.html`**, find the `CONFIG` block near the bottom:

```js
const CONFIG = {
  TOTAL_ROUNDS: 5,          // ← change this
  POINTS_PER_ROUND: 100,
  PLAYER_NAMES: ['Group 1', 'Group 2', 'Group 3', 'Group 4'],
  ROUNDS: [
    { image: 'images/product1.jpg', actualPrice: 150000, minigame: 'multiple-choice.html' },
    // add more rounds...
  ]
};
```

- `TOTAL_ROUNDS` — game ends after this many rounds and declares a winner.
- `ROUNDS` array — one entry per round. Must be at least `TOTAL_ROUNDS` long.
- `minigame` — which file inside `minigames/` to load. Can be the same file repeated.

### 2. Add product images
Place images in the `images/` folder.  
**Recommended size: 800 × 340 px** (matches the product display area).

### 3. Edit multiple-choice questions
Open `minigames/multiple-choice.html` and find the `QUESTIONS` array.  
Each entry follows this shape:

```js
{
  title:    'Mini Game: My Question',
  question: 'Question text here?',
  image:    '../images/hint.jpg',  // optional — leave '' to hide
  options: [
    { label: 'A', text: 'Option A' },
    { label: 'B', text: 'Option B' },
    { label: 'C', text: 'Option C' },
    { label: 'D', text: 'Option D' },
  ],
  correct: 'B',   // ← which label is the right answer
}
```

A random question is picked each time the minigame loads.

### 4. Adjust shell game difficulty
Open `minigames/shell-game.html` and edit:

```js
const NUM_CUPS   = 3;    // 2 = easier, 3 = harder
const SHUFFLES   = 7;    // more = harder
const SWAP_SPEED = 420;  // ms — lower = faster (harder)
```

---

## Adding a New Mini Game

1. Create `minigames/my-new-game.html`
2. The file must call this when done:
   ```js
   window.parent.postMessage({ result: true },  '*');  // player wins
   window.parent.postMessage({ result: false }, '*');  // player loses
   ```
3. Reference it in `CONFIG.ROUNDS`:
   ```js
   { image: 'images/product3.jpg', actualPrice: 75000, minigame: 'my-new-game.html' }
   ```
4. Test it standalone by opening `minigames/my-new-game.html` directly in a browser.

---

## How to Run

Because of browser security, open via a local server — not by double-clicking the file.

**Option A — VS Code:**  
Install the "Live Server" extension → right-click `index.html` → Open with Live Server.

**Option B — Python (if installed):**
```bash
cd price-is-right
python -m http.server 8080
# open http://localhost:8080
```

**Option C — Node.js:**
```bash
npx serve price-is-right
```

---

## Score Flow Summary

```
Round starts
  → teacher shows product image (in product area)
  → all 4 groups enter their price guess
  → click Confirm
  → closest guess wins face-off
  → orange popup shows winner + points at stake
  → click "Play Mini Game"
  → minigame loads in overlay iframe
  → minigame posts {result: true/false}
  → score awarded (or not)
  → next round automatically
  → after TOTAL_ROUNDS → winner screen + confetti
```

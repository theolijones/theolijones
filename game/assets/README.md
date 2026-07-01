# Charm Gian — Image Assets

Drop your images here with these **exact filenames** and the game picks them up automatically.
Until they exist, the game shows themed fallback backgrounds and an emoji Gian, so it always runs.

## Scene backgrounds (one per meeting) — landscape, ideally 1920×1080
| File | Venue |
|------|-------|
| `scene-office.jpg` | Meeting 1 — Gian's grand office |
| `scene-golf.jpg` | Meeting 2 — the golf course |
| `scene-restaurant.jpg` | Meeting 3 — the dark, moody restaurant |
| `scene-yacht.jpg` | Meeting 4 — the superyacht |

## Gian character portrait (transparent PNG cut-out, stands in the centre)
| File | Expression | Shown when Happiness is… |
|------|------------|--------------------------|
| `gian-high.png` | delighted / smiling | High (💚 67–100) |
| `gian-mid.png`  | neutral | Mid (💛 34–66) |
| `gian-low.png`  | annoyed / frowning | Low (❤️ 0–33) |

Notes
- Any missing file just falls back gracefully — you can add them one at a time.
- `.jpg` is expected for scenes and `.png` for the portrait (so transparency works). If your files use different extensions, either rename them or tell me and I'll update the paths in `charm-gian.html`.

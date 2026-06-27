# Visual Regression

Cross-device layout snapshots. Run when shipping UI changes.

```bash
# 1. First time only — capture baselines
node scripts/visual-regression.mjs

# 2. After any UI change — compare against baselines
node scripts/visual-regression.mjs --compare

# 3. Accept new look as the baseline
UPDATE=1 node scripts/visual-regression.mjs
```

Devices covered: iPhone SE, iPhone 15 Pro, Galaxy S9+ (Samsung), iPad Mini,
iPad Pro 11", Mac 1440x900 @2x, Windows 1920x1080. Routes: `/`, `/welcome`,
`/messenger`, `/library`, `/buy-coins`, `/referrals`. Tune via `ROUTES` and
`VIEWPORTS` in `scripts/visual-regression.mjs`.

Failures write a pixel-diff PNG to `tests/visual/diff/`. Default tolerance
is 2% changed pixels — override with `THRESHOLD=0.01`.

Requires `pixelmatch` and `pngjs`:

```bash
bun add -d pixelmatch pngjs playwright
```

Baselines and diffs live under `tests/visual/` — gitignore `current/` and
`diff/`, commit `baseline/`.

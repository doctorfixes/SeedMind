# @seedmind/theme

Design-token package for SeedMind — single source of truth for colors, spacing, typography, shadows, and motion.

## Files

| File | Purpose |
|------|---------|
| `tokens.css` | CSS custom properties — import this before any component stylesheet |
| `index.js`   | JS mirror of every token (for use in JS/TS contexts) |

## Token Taxonomy

| Prefix | Examples |
|--------|---------|
| `--color-*`   | `--color-primary-600`, `--color-surface`, `--color-error` |
| `--space-*`   | `--space-1` (4 px) … `--space-12` (48 px) |
| `--text-*`    | `--text-sm`, `--text-lg` |
| `--font-*`    | `--font-sans` |
| `--radius-*`  | `--radius-sm`, `--radius-md`, `--radius-lg` |
| `--shadow-*`  | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| `--motion-*`  | `--motion-duration-base`, `--motion-easing-default` |
| `--transition-*` | `--transition-colors`, `--transition-transform` |

## Dark Mode

All semantic color tokens are automatically overridden under `@media (prefers-color-scheme: dark)` inside `tokens.css`. No additional work is needed — just use the semantic tokens.

## Usage

### CSS
```html
<link rel="stylesheet" href="path/to/packages/theme/tokens.css" />
```
```css
.button {
  background: var(--color-primary-600);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  transition: var(--transition-colors);
}
```

### JavaScript / Node.js
```js
const { colors, spacing, motion } = require('@seedmind/theme');
```

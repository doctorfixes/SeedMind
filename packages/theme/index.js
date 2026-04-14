/**
 * @seedmind/theme — Design token exports (JS mirror of tokens.css)
 * Use these in JS/TS contexts where CSS custom properties are unavailable.
 */
'use strict';

// ─── Primitive Palette ────────────────────────────────────────────────────────
const palette = {
  green900: '#0d2318',
  green800: '#1a3d2b',
  green700: '#245237',
  green600: '#2e7d52',
  green500: '#3d9966',
  green400: '#4caf7d',
  green300: '#7ecb9f',
  green200: '#b2d8bf',
  green100: '#d4e8db',
  green50:  '#e8f5ee',

  neutral900: '#111827',
  neutral800: '#1c2b22',
  neutral700: '#374151',
  neutral600: '#607060',
  neutral500: '#6b7280',
  neutral200: '#e0ede5',
  neutral100: '#f4faf6',
  white:      '#ffffff',

  red500:    '#c0392b',
  red100:    '#fdecea',
  amber500:  '#d97706',
  amber100:  '#fef3c7',
};

// ─── Semantic Color Roles ─────────────────────────────────────────────────────
const colors = {
  // Primary
  'color-primary-900':   palette.green900,
  'color-primary-800':   palette.green800,
  'color-primary-700':   palette.green700,
  'color-primary-600':   palette.green600,
  'color-primary-500':   palette.green500,
  'color-primary-400':   palette.green400,
  'color-primary-300':   palette.green300,
  'color-primary-200':   palette.green200,
  'color-primary-100':   palette.green100,
  'color-primary-50':    palette.green50,

  // Surface
  'color-surface':        palette.white,
  'color-surface-raised': palette.white,

  // Background
  'color-bg':             palette.neutral100,
  'color-bg-subtle':      palette.green50,

  // Text
  'color-text-primary':   palette.neutral800,
  'color-text-secondary': palette.neutral600,
  'color-text-inverse':   palette.white,
  'color-text-disabled':  palette.neutral500,

  // Border
  'color-border':         palette.green100,
  'color-border-focus':   palette.green400,
  'color-border-input':   palette.green200,

  // Semantic
  'color-success':        palette.green600,
  'color-warning':        palette.amber500,
  'color-error':          palette.red500,
  'color-error-subtle':   palette.red100,
  'color-warning-subtle': palette.amber100,
};

// ─── Spacing Scale ────────────────────────────────────────────────────────────
const spacing = {
  'space-1':  '4px',
  'space-2':  '8px',
  'space-3':  '12px',
  'space-4':  '16px',
  'space-5':  '20px',
  'space-6':  '24px',
  'space-8':  '32px',
  'space-10': '40px',
  'space-12': '48px',
};

// ─── Typography ───────────────────────────────────────────────────────────────
const typography = {
  'font-sans':   "'Segoe UI', system-ui, -apple-system, sans-serif",

  'text-xs':   '0.75rem',
  'text-sm':   '0.875rem',
  'text-base': '1rem',
  'text-lg':   '1.125rem',
  'text-xl':   '1.25rem',
  'text-2xl':  '1.5rem',
  'text-3xl':  '1.875rem',

  'leading-tight':  '1.25',
  'leading-normal': '1.5',
  'leading-relaxed': '1.625',

  'tracking-tight':  '-0.01em',
  'tracking-normal': '0',
  'tracking-wide':   '0.02em',
};

// ─── Border Radius ────────────────────────────────────────────────────────────
const radius = {
  'radius-sm':   '6px',
  'radius-md':   '12px',
  'radius-lg':   '16px',
  'radius-xl':   '24px',
  'radius-full': '9999px',
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
const shadows = {
  'shadow-sm': '0 1px 4px rgba(0,0,0,.06)',
  'shadow-md': '0 2px 12px rgba(0,0,0,.08)',
  'shadow-lg': '0 4px 24px rgba(0,0,0,.12)',
};

// ─── Motion / Animation ───────────────────────────────────────────────────────
const motion = {
  'motion-duration-fast':   '120ms',
  'motion-duration-base':   '200ms',
  'motion-duration-slow':   '350ms',
  'motion-easing-default':  'cubic-bezier(0.4, 0, 0.2, 1)',
  'motion-easing-spring':   'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'motion-easing-out':      'cubic-bezier(0, 0, 0.2, 1)',
};

// ─── Component Sizes ─────────────────────────────────────────────────────────
const sizes = {
  'size-touch-target': '44px',
  'size-btn-md':       '42px',
};

module.exports = { palette, colors, spacing, typography, radius, shadows, motion, sizes };

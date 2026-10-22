/**
 * Shared enter animations for staggered page reveals.
 *
 * Three deliberate choices here:
 *
 * - `fill-mode-both` is required. tw-animate-css defaults animation-fill-mode
 *   to `none`, so a delayed element would paint fully visible for the length of
 *   its delay and only then jump to opacity 0 to animate.
 * - `animation-duration-*` rather than `duration-*`. Tailwind's `duration-*`
 *   also sets `transition-duration`, which would hijack the hover/active
 *   transitions of any interactive element it lands on (tab triggers, buttons).
 *   Same reason delays go through the `delay()`/`stagger()` inline styles below
 *   instead of `delay-*`, which also sets `transition-delay`.
 * - Opacity only, no transform. A transform on an ancestor changes the
 *   offsetParent of everything inside it, which breaks position/measurement-
 *   sensitive children — react-dnd hit testing, Embla carousels,
 *   react-resizable handles — for the duration of the animation. So these are
 *   safe to wrap around anything.
 */
const ENTER_BASE =
  "animate-in fade-in ease-out fill-mode-both motion-reduce:animate-none";

/** Standard page-block reveal. Pair with `delay()` or `stagger()`. */
export const enter = `${ENTER_BASE} animation-duration-500`;

/**
 * Shorter variant for content that re-animates on interaction (e.g. a tab panel
 * remounting on every switch), where the full 500ms reads as lag.
 */
export const enterFast = `${ENTER_BASE} animation-duration-300`;

/** Delay a single element's reveal, in ms. */
export const delay = (ms) => ({ animationDelay: `${ms}ms` });

/** Stagger a group of siblings by index. */
export const stagger = (index, { start = 0, step = 50 } = {}) => ({
  animationDelay: `${start + index * step}ms`,
});

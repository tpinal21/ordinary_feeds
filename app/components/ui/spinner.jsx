import { cn } from "app/lib/utils";

// Plain CSS spinner: unlike `<s-spinner>`, it paints straight from the SSR HTML
// without waiting for polaris.js to download and define the web component.
export function Spinner({ className, label = "Loading" }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("flex items-center justify-center py-16", className)}
    >
      <span className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
    </div>
  );
}

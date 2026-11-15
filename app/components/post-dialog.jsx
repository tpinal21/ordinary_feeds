import { InstagramLogo } from "app/components/icons/instagram-logo";
import { VolumeIcon } from "app/components/icons/volume-icon";
import { VolumeOffIcon } from "app/components/icons/volume-off-icon";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "app/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "app/components/ui/carousel";
import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { APP_SETTINGS_KEY } from "app/lib/app-settings";
import { cn } from "app/lib/utils";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  HeartIcon,
  PlayIcon,
  SendIcon,
  ShoppingBagIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";

// The connected Instagram account, when rendered inside the app's routes.
const useInstagramAccount = () =>
  useOutletContext()?.shopDetails?.instagram_account?.find(
    (acc) => acc.status == "CONNECTED",
  );

export const useInstagramUsername = () => useInstagramAccount()?.username;

// The account's profile picture over the Instagram-gradient badge. Instagram
// serves it from a signed CDN URL that expires after a few days, so when it
// fails to load the badge with the Instagram logo shows instead.
const Avatar = () => {
  const src = useInstagramAccount()?.profile_picture_url;
  const [failed, setFailed] = useState(false);

  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600">
      <InstagramLogo className="size-4" />
      {src && !failed && (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
};

// What clicking a post in a feed preview does, from Settings → Post clicks
// (`click.action`), mirroring the theme extension's feed.js: each action
// falls back to the next one the post supports, product -> Instagram ->
// popup. In the admin, "product" opens the product in the Shopify admin (the
// preview has no storefront URL for it). Returns `(index) => void`, where
// `openPost(index)` opens the PostDialog.
export function usePostClick(posts, openPost) {
  const { data } = useFetch(APP_SETTINGS_KEY, ({ key }) => apiFetch(key));
  const action = data?.data?.click?.action ?? "popup";

  return (index) => {
    if (action === "none") return;

    const post = posts[index];
    const product = taggedProducts(post)[0];
    if (action === "product" && product && adminProductUrl(product)) {
      window.open(adminProductUrl(product), "_blank", "noopener");
      return;
    }
    if ((action === "product" || action === "instagram") && post?.permalink) {
      window.open(post.permalink, "_blank", "noopener");
      return;
    }
    openPost(index);
  };
}

// Round, translucent control used for every button over the dark backdrop.
const roundButton =
  "flex items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer disabled:opacity-30 disabled:cursor-default";

const shareUrl = (post) => post?.permalink ?? post?.media_url;

const sharePost = async (post) => {
  const url = shareUrl(post);
  if (!url) return;
  try {
    if (navigator.share) await navigator.share({ url });
    else await navigator.clipboard.writeText(url);
  } catch {
    // Dismissed share sheet or blocked clipboard: nothing to do.
  }
};

// Every tagged product with its details loaded (`products` holds junction
// rows; a bare id means the details weren't fetched).
const taggedProducts = (post) =>
  (post?.products ?? [])
    .map((p) => p?.product_id)
    .filter((p) => p && typeof p === "object");

// Product ids are GIDs (gid://shopify/Product/123); the admin URL wants the
// number.
const adminProductUrl = (product) => {
  const id = String(product.id ?? "")
    .split("/")
    .pop();
  return id ? `shopify://admin/products/${id}` : undefined;
};

// In the app the card opens the product in the Shopify admin (a new tab, so
// the preview stays put); the storefront's links to the product page.
const ProductCard = ({ product, className }) => (
  <a
    href={adminProductUrl(product)}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      "flex items-center gap-3 rounded-lg bg-white/10 p-2 backdrop-blur-md transition-colors hover:bg-white/20",
      className,
    )}
  >
    <span className="size-14 shrink-0 overflow-hidden rounded-md bg-white">
      {product.images?.[0]?.original_src && (
        <img
          src={product.images[0].original_src}
          alt=""
          className="size-full object-contain"
        />
      )}
    </span>
    <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-white">
      {product.title}
    </span>
    <ChevronRightIcon className="size-4 shrink-0 text-white/60" />
  </a>
);

// "Shop this post": the tagged products, stacked beside the video on wide
// screens and as a swipeable row over it on narrow ones.
const ProductList = ({ products, row }) => (
  <div className="flex flex-col gap-2">
    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
      <ShoppingBagIcon className="size-3.5" />
      Shop this post
      {products.length > 1 && (
        <span className="text-white/50">({products.length})</span>
      )}
    </span>
    <div
      className={cn(
        "flex gap-2",
        row
          ? "snap-x snap-mandatory overflow-x-auto scrollbar-none"
          : "max-h-[40vh] flex-col overflow-y-auto",
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          className={row ? "w-56 shrink-0 snap-start" : undefined}
        />
      ))}
    </div>
  </div>
);

// Account, caption and tagged products. Sits left of the video on wide
// screens and over its bottom edge on narrow ones (`row`).
const PostInfo = ({ post, username, row, showProducts, className }) => {
  const [expanded, setExpanded] = useState(false);
  const products = showProducts ? taggedProducts(post) : [];

  return (
    <div className={cn("flex flex-col gap-3 text-white", className)}>
      {username && (
        <a
          href={`https://www.instagram.com/${encodeURIComponent(username)}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-2 hover:underline"
        >
          <Avatar />
          <span className="text-sm font-semibold">{username}</span>
        </a>
      )}
      {post.caption && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            "cursor-pointer whitespace-pre-line text-left text-sm leading-snug",
            !expanded && "line-clamp-3",
          )}
        >
          {post.caption}
        </button>
      )}
      {products.length > 0 && <ProductList products={products} row={row} />}
    </div>
  );
};

const ActionButton = ({ label, children, ...props }) => (
  <div className="flex flex-col items-center gap-1">
    <button
      type="button"
      aria-label={label}
      className={cn(roundButton, "size-11")}
      {...props}
    >
      {children}
    </button>
    <span className="text-[11px] text-white/80">{label}</span>
  </div>
);

// 30412 -> "30.4K", 3048211 -> "3M": stored exact, shortened for display.
const formatCount = (n) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

// Instagram's like count. Display only: liking happens on Instagram. Left
// out when the owner hides likes (no count stored).
const LikeCount = ({ count }) => (
  <div className="flex flex-col items-center gap-1 text-white">
    <span
      className="flex size-11 items-center justify-center"
      aria-hidden="true"
    >
      <HeartIcon className="size-6" />
    </span>
    <span className="text-xs font-medium">
      {formatCount(count)}
      <span className="sr-only"> likes</span>
    </span>
  </div>
);

// Full screen height (less the layout's 1rem padding), 9:16, shrunk only
// when the screen is too narrow for that width. Sized from the viewport, not
// the grid, so the box can't be squeezed into a crop; the video inside uses
// object-fit: contain, so posts of any other shape are letterboxed, never cut.
const STAGE_SIZE = {
  height: "min(100dvh - 2rem, (100vw - 2rem) * 16 / 9)",
  width: "calc(min(100dvh - 2rem, (100vw - 2rem) * 16 / 9) * 9 / 16)",
};

// Only the current slide holds a <video>; its neighbours show their poster so
// a swipe reveals something straight away, and the rest stay empty. However
// long the feed, the dialog loads one video at a time.
const NEIGHBOURS = 1;

// Slides between two posts on a looping strip (the last post's neighbour is
// the first).
const loopDistance = (a, b, count) => {
  const d = Math.abs(a - b);
  return Math.min(d, count - d);
};

// One mouse-wheel / trackpad swipe moves one post: Embla doesn't handle the
// wheel, and a trackpad fires dozens of events per swipe.
const WHEEL_THRESHOLD = 40;
const WHEEL_LOCK_MS = 500;

// The playing post. Remounted per post (keyed by the caller), so every post
// starts from the top with fresh state.
const Stage = ({ post, muted, onToggleMute }) => {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Opening the dialog is a click, so playing with sound is allowed; if the
    // browser still refuses, fall back to a muted start.
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div className="relative size-full bg-black">
      <video
        ref={videoRef}
        src={post.media_url}
        poster={post.thumbnail_url ?? undefined}
        loop
        playsInline
        onClick={togglePlay}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
        className="size-full cursor-pointer object-contain"
      />

      {paused && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
            <PlayIcon className="size-7 fill-current" />
          </span>
        </span>
      )}

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute right-3 top-3 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
      >
        {muted ? (
          <VolumeOffIcon className="size-4" />
        ) : (
          <VolumeIcon className="size-4" />
        )}
      </button>

      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/25">
        <div className="h-full bg-white" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

// Full-screen, reels-style viewer for a feed's posts: the video in the
// middle, account and caption to its left, actions to its right and
// previous / next on the far right. The theme extension's feed.js builds
// the same layout from carousel.css.
// `showProducts` is the feed's "Show tagged products": off drops "Shop this
// post" from the popup.
export function PostDialog({
  posts,
  index,
  onIndexChange,
  username,
  showProducts = true,
}) {
  const [muted, setMuted] = useState(false);
  const [api, setApi] = useState(null);
  const open = index != null;
  const post = open ? posts[index] : null;
  // The strip loops, so there's always a previous and next post.
  const canMove = open && posts.length > 1;

  // Embla owns the position: the arrows, keys and wheel scroll it, and its
  // `select` reports the new post back.
  useEffect(() => {
    if (!api) return;
    const onSelect = () => onIndexChange(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => api.off("select", onSelect);
  }, [api, onIndexChange]);

  const go = useCallback(
    (step) => (step < 0 ? api?.scrollPrev() : api?.scrollNext()),
    [api],
  );

  const wheelRef = useRef({ delta: 0, locked: false });
  const onWheel = (e) => {
    const wheel = wheelRef.current;
    if (wheel.locked) return;
    wheel.delta += e.deltaY;
    if (Math.abs(wheel.delta) < WHEEL_THRESHOLD) return;
    go(wheel.delta);
    wheel.delta = 0;
    wheel.locked = true;
    setTimeout(() => (wheel.locked = false), WHEEL_LOCK_MS);
  };

  const onKeyDown = (e) => {
    // The carousel already handled ← / → while focused.
    if (e.defaultPrevented) return;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        // The popup fills the screen, so the overlay never gets the click:
        // close on the empty dark area instead.
        onClick={(e) => e.target === e.currentTarget && onIndexChange(null)}
        className="inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 rounded-none bg-neutral-950/95 p-0 ring-0 sm:max-w-none"
      >
        {post && (
          <>
            <DialogTitle className="sr-only">Instagram post</DialogTitle>
            <DialogDescription className="sr-only">
              {post.caption || "Instagram post"}
            </DialogDescription>

            <div
              role="presentation"
              onClick={(e) =>
                e.target === e.currentTarget && onIndexChange(null)
              }
              className="grid h-full w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 p-4"
            >
              {/* Wide screens: info beside the video. */}
              <PostInfo
                key={`info-${post.id}`}
                post={post}
                username={username}
                showProducts={showProducts}
                className="hidden w-64 max-w-full justify-self-end pb-2 md:flex"
              />

              <div className="relative col-start-2" onWheel={onWheel}>
                <PostCarousel
                  posts={posts}
                  index={index}
                  setApi={setApi}
                  muted={muted}
                  onToggleMute={() => setMuted((m) => !m)}
                />
                {/* Narrow screens: info over the bottom of the video. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-lg bg-linear-to-t from-black/80 to-transparent p-4 pt-16 md:hidden">
                  <PostInfo
                    key={`info-sm-${post.id}`}
                    post={post}
                    username={username}
                    showProducts={showProducts}
                    row
                    className="pointer-events-auto pr-14"
                  />
                </div>
              </div>

              <div className="absolute right-4 bottom-8 flex flex-col gap-4 md:static md:justify-self-start md:pb-2">
                {Number.isFinite(post.like_count) && (
                  <LikeCount count={post.like_count} />
                )}
                {post.permalink && (
                  <ActionButton
                    label="Instagram"
                    onClick={() =>
                      window.open(post.permalink, "_blank", "noopener")
                    }
                  >
                    <InstagramLogo className="size-5" />
                  </ActionButton>
                )}
                <ActionButton label="Share" onClick={() => sharePost(post)}>
                  <SendIcon className="size-5" />
                </ActionButton>
              </div>
            </div>

            <div className="absolute top-1/2 right-4 flex -translate-y-1/2 flex-col gap-3">
              <button
                type="button"
                aria-label="Previous post"
                disabled={!canMove}
                onClick={() => go(-1)}
                className={cn(roundButton, "size-12")}
              >
                <ChevronUpIcon className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next post"
                disabled={!canMove}
                onClick={() => go(1)}
                className={cn(roundButton, "size-12")}
              >
                <ChevronDownIcon className="size-6" />
              </button>
            </div>

            <DialogClose
              aria-label="Close"
              className={cn(roundButton, "absolute top-4 right-4 size-10")}
            >
              <XIcon className="size-5" />
            </DialogClose>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// The vertical, swipeable strip of posts. Mounted fresh each time the dialog
// opens (the popup unmounts when closed), so the opening post is only needed
// as Embla's start index, not tracked afterwards.
function PostCarousel({ posts, index, setApi, muted, onToggleMute }) {
  const [startIndex] = useState(index);

  return (
    <Carousel
      orientation="vertical"
      opts={{ startIndex, loop: true }}
      setApi={setApi}
      style={STAGE_SIZE}
      className="overflow-hidden rounded-lg bg-black [&>[data-slot=carousel-content]]:h-full"
    >
      <CarouselContent className="mt-0 h-full">
        {posts.map((p, i) => (
          <CarouselItem key={p.id ?? i} className="pt-0">
            {i === index ? (
              <Stage post={p} muted={muted} onToggleMute={onToggleMute} />
            ) : loopDistance(i, index, posts.length) <= NEIGHBOURS &&
              p.thumbnail_url ? (
              <img
                src={p.thumbnail_url}
                alt=""
                className="size-full object-contain"
              />
            ) : null}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

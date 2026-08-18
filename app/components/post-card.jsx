import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { VolumeIcon } from "app/components/icons/volume-icon";
import { VolumeOffIcon } from "app/components/icons/volume-off-icon";
import { PlusIcon } from "lucide-react";
import { cn } from "app/lib/utils";

const posterSrc = (post) => post?.thumbnail_url ?? post?.media_url;

// When auto play is on, videos loop just the first few seconds as a teaser
// until the card is hovered.
const PREVIEW_SECONDS = 3;

// Only one card may have sound at a time. `activeId` holds the id of that card
// (null = every card muted). Unmuting one card therefore mutes all others.
const audioStore = {
  activeId: null,
  listeners: new Set(),
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
  getSnapshot() {
    return this.activeId;
  },
  setActive(id) {
    if (this.activeId === id) return;
    this.activeId = id;
    this.listeners.forEach((l) => l());
  },
};

export default function PostCard({
  post,
  selected = false,
  onSelect = () => {},
  hideCheckbox = false,
  showDeleteButton = false,
  onDelete,
  showTagProducts = false,
  onTagProduct,
  autoPlay = false,
  checkBoxDisabled = false,
  className,
}) {
  const videoRef = useRef(null);
  const hoveringRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const id = useId();

  const taggedProduct = post?.products?.[0]?.product_id ?? null;

  // This card has sound only while it is the active one; every other card mutes.
  const activeId = useSyncExternalStore(
    (l) => audioStore.subscribe(l),
    () => audioStore.getSnapshot(),
    () => null,
  );
  const muted = activeId !== id;

  // Keep this card's <video> element in sync with the shared mute state.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Start/stop the short preview loop when auto play is toggled.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (autoPlay) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
      setProgress(0);
    }
  }, [autoPlay]);

  const toggleMute = (e) => {
    e.stopPropagation();
    // Unmute this card (muting every other), or mute it if it already had sound.
    audioStore.setActive(muted ? id : null);
  };

  const handleEnter = () => {
    hoveringRef.current = true;
    // If another card currently has sound, move it to this one.
    if (audioStore.getSnapshot() !== null) audioStore.setActive(id);
    // Continue playing from the current position through to the end.
    videoRef.current?.play().catch(() => {});
  };

  const handleLeave = () => {
    hoveringRef.current = false;
    const v = videoRef.current;
    if (!v) return;
    if (autoPlay) {
      // Back to the short preview loop.
      v.currentTime = 0;
      setProgress(0);
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
      setProgress(0);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v?.duration) return;
    // While previewing (auto play on, not hovered), loop just the teaser and
    // keep the progress bar hidden.
    if (autoPlay && !hoveringRef.current) {
      if (v.currentTime >= PREVIEW_SECONDS) v.currentTime = 0;
      return;
    }
    setProgress((v.currentTime / v.duration) * 100);
  };

  const handlePickProducts = async () => {
    const picker = await shopify.resourcePicker({
      type: "product",
      filter: {
        variants: false,
      },
      multiple: false,
    });
    onTagProduct(picker[0]);
  };

  return (
    <div
      // `overflow-hidden` clips the <video> to whatever radius the caller's
      // class sets, so a feed's own corner radius only has to land here.
      className={cn(
        "group/post-card relative overflow-hidden rounded-md transition-opacity group/post-card border border-neutral-300 bg-neutral-100",
        { "brightness-75": selected },
        className,
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={togglePlay}
    >
      {!hideCheckbox && !showDeleteButton && (
        <div className="absolute z-10 left-1.5 top-1.5 size-4">
          <s-checkbox
            checked={selected}
            disabled={checkBoxDisabled}
            onChange={() => onSelect(selected ? false : true)}
          />
        </div>
      )}
      {showDeleteButton && (
        <>
          <s-tooltip id="info-tooltip">Remove media from gallery</s-tooltip>
          <button
            interestfor="info-tooltip"
            type="button"
            onClick={onDelete}
            className="absolute z-10 right-1 top-1 p-0.5 cursor-pointer invisible bg-neutral-100 transition-all group-hover/post-card:visible shadow-card rounded-md"
          >
            <s-icon type="delete" tone="critical" />
          </button>
        </>
      )}
      <video
        ref={videoRef}
        src={post?.media_url}
        poster={posterSrc(post)}
        muted={muted}
        loop
        playsInline
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        className="aspect-9/16 h-auto w-full group-hover/post-card:brightness-100 transition-all brightness-75 object-contain"
      />

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/25">
        <div
          className="h-full bg-white transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className={cn(
          "absolute right-1.5 bottom-1.5 group-hover/post-card:opacity-100 transition-all opacity-0 cursor-pointer size-6 rounded-full backdrop-blur-md flex justify-center items-center bg-neutral-600/20",
          { "top-1/2 left-1/2 -translate-1/2 size-10": showTagProducts },
        )}
      >
        {muted ? (
          <VolumeOffIcon
            className={cn("text-white size-4", { "size-5": showTagProducts })}
          />
        ) : (
          <VolumeIcon
            className={cn("text-white size-4", { "size-5": showTagProducts })}
          />
        )}
      </button>
      {showTagProducts && (
        <>
          {taggedProduct ? (
            <div className="absolute inset-x-0 bottom-0 p-2 bg-neutral-400/40 backdrop-blur-sm flex items-center gap-2">
              <img
                src={taggedProduct?.images?.[0]?.original_src}
                alt=""
                className="size-8 rounded-md object-contain bg-white"
              />
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-semibold text-white truncate">
                  {taggedProduct?.title}
                </h5>
              </div>

              <s-button
                icon="delete"
                variant="secondary"
                tone="critical"
                onClick={() => onTagProduct(undefined)}
              />
            </div>
          ) : (
            <div className="absolute right-2 bottom-2">
              <s-button
                icon="product-add"
                type="button"
                onClick={handlePickProducts}
                accessibilityLabel="Tag product"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

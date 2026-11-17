import PostCard from "app/components/post-card";
import {
  PostDialog,
  useInstagramUsername,
  usePostClick,
} from "app/components/post-dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "app/components/ui/carousel";
import AutoScroll from "embla-carousel-auto-scroll";
import { useEffect, useState } from "react";

// Slide width, gap and radius are all resolved in carousel.css from these three
// custom properties — that file holds the sizing rules, including the mobile
// override. Handing the settings over as variables instead of computed styles
// keeps this layout identical to the theme extension, which sets the very same
// properties from Liquid.
const carouselVars = (settings) => ({
  "--ordinary-feeds-per-view": settings?.slides_per_view || 1,
  "--ordinary-feeds-gap": `${settings?.item_gap ?? 0}px`,
  "--ordinary-feeds-radius": `${settings?.border_radius ?? 0}px`,
});

export function FeedCarousel({ media = [], settings }) {
  const [api, setApi] = useState(null);
  // Index of the post open in the dialog, null while closed.
  const [openIndex, setOpenIndex] = useState(null);
  const username = useInstagramUsername();
  const posts = media.filter((m) => typeof m !== "number");
  const onPostClick = usePostClick(posts, setOpenIndex);
  const showArrows = !settings?.auto_scroll;
  // "inside" | "outside" | "outside_full" — see carousel.css.
  const arrowPosition = showArrows ? settings?.arrow_position : undefined;
  const arrowClasses =
    {
      outside: ["left-0", "right-0"],
      outside_full: ["-left-10", "-right-10"],
    }[arrowPosition] || [];

  // Slide widths animate when the merchant changes "slides per view" (see
  // carousel.css). Embla reads the slides with offsetWidth once and derives the
  // distance it shifts them by to close the loop from that measurement; its own
  // ResizeObserver gives up re-measuring as soon as a frame moves a slide less
  // than half a pixel, which is the whole tail of the easing. The fraction it
  // misses is multiplied by the slide count and lands entirely on the seam
  // between the last and the first slide, so re-measure once the width has
  // actually settled.
  useEffect(() => {
    if (!api) return;

    const container = api.containerNode();
    let queued = false;

    const remeasure = (event) => {
      // Slides only — PostCard has transitions of its own.
      if (event.target.parentElement !== container || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        api.reInit();
      });
    };

    container.addEventListener("transitionend", remeasure);
    return () => container.removeEventListener("transitionend", remeasure);
  }, [api]);

  // Drive the auto-scroll plugin from this feed's own setting.
  useEffect(() => {
    const autoScroll = api?.plugins()?.autoScroll;
    if (!autoScroll) return;
    if (settings?.auto_scroll) {
      autoScroll.play();
    } else {
      autoScroll.stop();
    }
  }, [api, settings?.auto_scroll]);

  return (
    <Carousel
      className="ordinary-feeds-carousel"
      style={carouselVars(settings)}
      // carousel.css reserves a gutter for the arrows when they sit outside.
      data-arrows={arrowClasses.length ? arrowPosition : undefined}
      opts={{ loop: settings?.loop, dragFree: settings?.auto_scroll }}
      setApi={setApi}
      plugins={[
        AutoScroll({
          active: settings?.auto_scroll,
          startDelay: 0,
          speed: settings?.speed,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
          stopOnFocusIn: false,
        }),
      ]}
    >
      <CarouselContent className="ml-0 justify-center-safe">
        {media.map((m, ind) => (
          <CarouselItem
            key={m.id || ind}
            className="ordinary-feeds-carousel__slide"
          >
            {typeof m == "number" ? (
              <div className="ordinary-feeds-carousel__media w-full aspect-9/16 bg-gray-300 animate-pulse"></div>
            ) : (
              <PostCard
                post={m}
                hideCheckbox
                className="ordinary-feeds-carousel__media"
                autoPlay={settings?.media_auto_play}
                showProduct={settings?.show_tagged_products ?? true}
                onOpen={() => onPostClick(posts.indexOf(m))}
              />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
      {showArrows && (
        <>
          <CarouselPrevious className={arrowClasses[0]} />
          <CarouselNext className={arrowClasses[1]} />
        </>
      )}
      <PostDialog
        posts={posts}
        index={openIndex}
        onIndexChange={setOpenIndex}
        username={username}
        showProducts={settings?.show_tagged_products ?? true}
      />
    </Carousel>
  );
}

import PostCard from "app/components/post-card";
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
  "--insta-per-view": settings?.slides_per_view || 1,
  "--insta-gap": `${settings?.item_gap ?? 0}px`,
  "--insta-radius": `${settings?.border_radius ?? 0}px`,
});

export function FeedCarousel({ media = [], settings }) {
  const [api, setApi] = useState(null);

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
      className="insta-carousel"
      style={carouselVars(settings)}
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
          <CarouselItem key={m.id || ind} className="insta-carousel__slide">
            {typeof m == "number" ? (
              <div className="insta-carousel__media w-full aspect-9/16 bg-gray-300 animate-pulse"></div>
            ) : (
              <PostCard
                post={m}
                hideCheckbox
                className="insta-carousel__media"
                autoPlay={settings?.media_auto_play}
              />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
      {!settings?.auto_scroll && (
        <>
          <CarouselPrevious />
          <CarouselNext />
        </>
      )}
    </Carousel>
  );
}

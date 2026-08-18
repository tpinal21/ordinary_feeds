import useEmblaCarousel from "embla-carousel-react";
import * as React from "react";

import { cn } from "app/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const CarouselContext = React.createContext(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins,
  );
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api) => {
    if (!api) return;
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const handleKeyDown = React.useCallback(
    (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollNext();
      }
    },
    [scrollPrev, scrollNext],
  );

  React.useEffect(() => {
    if (!api || !setApi) return;
    setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) return;
    onSelect(api);
    api.on("reInit", onSelect);
    api.on("select", onSelect);

    return () => {
      api?.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation:
          orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, ...props }) {
  const { carouselRef, orientation } = useCarousel();

  return (
    <div
      ref={carouselRef}
      className="overflow-hidden"
      data-slot="carousel-content"
    >
      <div
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CarouselItem({ className, ...props }) {
  const { orientation } = useCarousel();

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className,
      )}
      {...props}
    />
  );
}

function CarouselPrevious({ ...props }) {
  const { scrollPrev, canScrollPrev } = useCarousel();

  return (
    <button
      type="button"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      className="cursor-pointer hover:bg-neutral-400/50 absolute z-10 touch-manipulation rounded-full p-1 top-1/2 left-0 -translate-y-1/2"
      {...props}
    >
      <ChevronLeftIcon />
      <span className="sr-only">Previous slide</span>
    </button>
  );
}

function CarouselNext({ ...props }) {
  const { scrollNext, canScrollNext } = useCarousel();

  return (
    <button
      type="button"
      disabled={!canScrollNext}
      onClick={scrollNext}
      className="cursor-pointer hover:bg-neutral-400/50 absolute touch-manipulation rounded-full p-1 top-1/2 right-0 -translate-y-1/2"
      {...props}
    >
      <ChevronRightIcon />
      <span className="sr-only">Next slide</span>
    </button>
  );
}

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
};

export const useAutoScroll = (emblaApi) => {
  const [autoScrollIsPlaying, setAutoScrollIsPlaying] = React.useState(false);

  const onAutoScrollButtonClick = React.useCallback(
    (callback) => {
      const autoScroll = emblaApi?.plugins()?.autoScroll;
      if (!autoScroll) return;

      autoScroll.stop();
      callback();
    },
    [emblaApi],
  );

  const toggleAutoScroll = React.useCallback(() => {
    const autoScroll = emblaApi?.plugins()?.autoScroll;
    if (!autoScroll) return;

    const playOrStop = autoScroll.isPlaying()
      ? autoScroll.stop
      : autoScroll.play;
    playOrStop();
  }, [emblaApi]);

  React.useEffect(() => {
    const autoScroll = emblaApi?.plugins()?.autoScroll;
    if (!autoScroll) return;

    setAutoScrollIsPlaying(autoScroll.isPlaying());
    emblaApi
      .on("autoscroll:play", () => setAutoScrollIsPlaying(true))
      .on("autoscroll:stop", () => setAutoScrollIsPlaying(false))
      .on("reinit", () => setAutoScrollIsPlaying(autoScroll.isPlaying()));
  }, [emblaApi]);

  return {
    autoScrollIsPlaying,
    toggleAutoScroll,
    onAutoScrollButtonClick,
  };
};

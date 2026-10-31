(function () {
  // When media auto play is on, videos loop just the first few seconds as a
  // teaser until the card is hovered — same as PREVIEW_SECONDS in PostCard.
  var PREVIEW_SECONDS = 3;

  function init(root) {
    if (!window.EmblaCarousel || root.dataset.emblaInitialized) return;
    root.dataset.emblaInitialized = "true";

    var viewport = root.querySelector(".insta-carousel__viewport");
    var prevBtn = root.querySelector(".insta-carousel__btn--prev");
    var nextBtn = root.querySelector(".insta-carousel__btn--next");
    if (!viewport) return;

    var loop = root.dataset.loop === "true";
    var autoScroll = root.dataset.autoScroll === "true";
    var mediaAutoPlay = root.dataset.mediaAutoPlay === "true";
    var speed = parseFloat(root.dataset.speed) || 1;

    // Options and plugin config mirror app/components/feed-carousel.jsx.
    var plugins = [];
    if (autoScroll && window.EmblaCarouselAutoScroll) {
      plugins.push(
        window.EmblaCarouselAutoScroll({
          startDelay: 0,
          speed: speed,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
          stopOnFocusIn: false,
        }),
      );
    }

    var embla = window.EmblaCarousel(
      viewport,
      { loop: loop, dragFree: autoScroll },
      plugins,
    );

    function update() {
      if (prevBtn) prevBtn.disabled = !embla.canScrollPrev();
      if (nextBtn) nextBtn.disabled = !embla.canScrollNext();
    }

    if (prevBtn) prevBtn.addEventListener("click", embla.scrollPrev);
    if (nextBtn) nextBtn.addEventListener("click", embla.scrollNext);

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        embla.scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        embla.scrollNext();
      }
    });

    embla.on("select", update);
    embla.on("reInit", update);
    update();

    // Per-card video behavior, mirroring the app's PostCard. Only one card may
    // have sound at a time: `activeCard` is that card (null = all muted).
    var cards = [];
    var activeCard = null;

    function setActive(entry) {
      if (activeCard === entry) return;
      activeCard = entry;
      cards.forEach(function (c) {
        var muted = c !== activeCard;
        c.video.muted = muted;
        c.card.classList.toggle("is-unmuted", !muted);
        if (c.muteBtn) {
          c.muteBtn.setAttribute(
            "aria-label",
            muted ? "Unmute video" : "Mute video",
          );
        }
      });
    }

    root.querySelectorAll("[data-insta-card]").forEach(function (card) {
      var video = card.querySelector("[data-insta-video]");
      if (!video) return;
      var bar = card.querySelector("[data-insta-progress]");
      var muteBtn = card.querySelector("[data-insta-mute]");
      var entry = {
        card: card,
        video: video,
        muteBtn: muteBtn,
        hovering: false,
      };
      cards.push(entry);

      video.muted = true;

      function resetProgress() {
        if (bar) bar.style.width = "0%";
      }

      card.addEventListener("mouseenter", function () {
        entry.hovering = true;
        // If another card currently has sound, move it to this one.
        if (activeCard !== null) setActive(entry);
        // Continue playing from the current position through to the end.
        video.play().catch(function () {});
      });

      card.addEventListener("mouseleave", function () {
        entry.hovering = false;
        video.currentTime = 0;
        resetProgress();
        if (mediaAutoPlay) {
          // Back to the short preview loop.
          video.play().catch(function () {});
        } else {
          video.pause();
        }
      });

      card.addEventListener("click", function () {
        if (video.paused) video.play().catch(function () {});
        else video.pause();
      });

      video.addEventListener("timeupdate", function () {
        if (!video.duration) return;
        // While previewing (auto play on, not hovered), loop just the teaser
        // and keep the progress bar hidden.
        if (mediaAutoPlay && !entry.hovering) {
          if (video.currentTime >= PREVIEW_SECONDS) video.currentTime = 0;
          return;
        }
        if (bar) {
          bar.style.width = (video.currentTime / video.duration) * 100 + "%";
        }
      });

      if (muteBtn) {
        muteBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          // Unmute this card (muting every other), or mute it if it already had sound.
          setActive(activeCard === entry ? null : entry);
        });
      }

      if (mediaAutoPlay) video.play().catch(function () {});
    });
  }

  function initAll() {
    document.querySelectorAll("[data-insta-carousel]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  document.addEventListener("shopify:section:load", initAll);
  document.addEventListener("shopify:block:select", initAll);
})();

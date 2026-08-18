(function () {
  function init(root) {
    if (!window.EmblaCarousel || root.dataset.emblaInitialized) return;
    root.dataset.emblaInitialized = "true";

    var viewport = root.querySelector(".insta-carousel__viewport");
    var prevBtn = root.querySelector(".insta-carousel__btn--prev");
    var nextBtn = root.querySelector(".insta-carousel__btn--next");
    if (!viewport) return;

    var loop = root.dataset.loop === "true";
    var autoScroll = root.dataset.autoScroll === "true";
    var embla = window.EmblaCarousel(viewport, {
      loop: loop,
      dragFree: autoScroll,
    });

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

    // Per-slide video behavior, mirroring the app's PostCard:
    // hover to play, leave to reset, click to toggle, plus a mute button and
    // a progress bar tracking playback. Mute is a single shared state for the
    // whole carousel — toggling any card's button mutes/unmutes every video.
    var cards = [];
    var muted = true;

    function applyMuted() {
      cards.forEach(function (entry) {
        entry.video.muted = muted;
        entry.card.classList.toggle("is-unmuted", !muted);
        if (entry.muteBtn) {
          entry.muteBtn.setAttribute(
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
      cards.push({ card: card, video: video, muteBtn: muteBtn });

      video.muted = muted;

      card.addEventListener("mouseenter", function () {
        video.play().catch(function () {});
      });
      card.addEventListener("mouseleave", function () {
        video.pause();
        video.currentTime = 0;
        if (bar) bar.style.width = "0%";
      });
      card.addEventListener("click", function () {
        if (video.paused) video.play().catch(function () {});
        else video.pause();
      });

      video.addEventListener("timeupdate", function () {
        if (!bar || !video.duration) return;
        bar.style.width = (video.currentTime / video.duration) * 100 + "%";
      });

      if (muteBtn) {
        muteBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          // Single shared state: toggle once, apply to every card.
          muted = !muted;
          applyMuted();
        });
      }
    });

    if (root.dataset.autoplay === "true") {
      var delay = (parseInt(root.dataset.autoplayDelay, 10) || 4) * 1000;
      var timer = null;
      var paused = false;

      function tick() {
        if (paused || document.hidden) return;
        if (embla.canScrollNext()) embla.scrollNext();
        else if (loop) embla.scrollNext();
        else embla.scrollTo(0);
      }

      function start() {
        stop();
        timer = setInterval(tick, delay);
      }
      function stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      root.addEventListener("mouseenter", function () {
        paused = true;
      });
      root.addEventListener("mouseleave", function () {
        paused = false;
      });
      root.addEventListener("focusin", function () {
        paused = true;
      });
      root.addEventListener("focusout", function () {
        paused = false;
      });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop();
        else start();
      });

      start();
    }
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

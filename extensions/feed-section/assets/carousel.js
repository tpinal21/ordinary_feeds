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

    var dialog = root.querySelector("[data-insta-dialog]");

    root.addEventListener("keydown", function (e) {
      // The dialog handles its own keys.
      if (dialog && dialog.contains(e.target)) return;
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

    var openPost = dialog ? setupDialog(dialog, cards) : null;

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
        if (openPost) {
          openPost(cards.indexOf(entry));
          return;
        }
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

  // Wires the block's post dialog (see the markup in carousel.liquid) and
  // returns `openPost(index)`. `cards` is the carousel's card list, filled in
  // after this runs; each entry's `card` holds the post's data attributes and
  // its <template data-insta-details>.
  function setupDialog(dialog, cards) {
    var video = dialog.querySelector("[data-insta-dialog-video]");
    var stage = dialog.querySelector("[data-insta-dialog-stage]");
    var track = dialog.querySelector("[data-insta-dialog-track]");
    var bar = dialog.querySelector("[data-insta-dialog-progress]");
    var muteBtn = dialog.querySelector("[data-insta-dialog-mute]");
    var prevBtn = dialog.querySelector("[data-insta-dialog-prev]");
    var nextBtn = dialog.querySelector("[data-insta-dialog-next]");
    var closeBtn = dialog.querySelector("[data-insta-dialog-close]");
    var shareBtn = dialog.querySelector("[data-insta-dialog-share]");
    var permalink = dialog.querySelector("[data-insta-dialog-permalink]");
    var side = dialog.querySelector("[data-insta-info]");
    var slot = dialog.querySelector("[data-insta-details-slot]");
    var overlay = dialog.querySelector("[data-insta-info-overlay]");
    var current = -1;
    var muted = false;
    // The vertical carousel, created on first open (Embla can't measure a
    // closed, display: none dialog) along with one slide per post.
    var embla = null;
    var slides = [];

    // Only the current slide holds the (single) <video>; its neighbours get
    // their poster so a swipe reveals something straight away, the rest stay
    // empty. However long the feed, one video loads at a time.
    var NEIGHBOURS = 1;

    function buildSlides() {
      slides = cards.map(function () {
        var slide = document.createElement("div");
        slide.className = "insta-dialog__slide";
        track.appendChild(slide);
        return slide;
      });
    }

    function renderSlides(index) {
      slides.forEach(function (slide, i) {
        if (i === index) {
          var poster = slide.querySelector(".insta-dialog__poster");
          if (poster) poster.remove();
          slide.appendChild(video);
          return;
        }
        // The strip loops: the last post's neighbour is the first.
        var d = Math.abs(i - index);
        var near = Math.min(d, slides.length - d) <= NEIGHBOURS;
        var img = slide.querySelector(".insta-dialog__poster");
        var src = cards[i].card.dataset.poster;
        if (near && src && !img) {
          img = document.createElement("img");
          img.className = "insta-dialog__poster";
          img.alt = "";
          img.src = src;
          slide.appendChild(img);
        } else if (!near && img) {
          img.remove();
        }
      });
    }

    function setMuted(value) {
      muted = value;
      video.muted = value;
      dialog.classList.toggle("is-muted", value);
      muteBtn.setAttribute("aria-label", value ? "Unmute video" : "Mute video");
    }

    function show(index) {
      var entry = cards[index];
      if (!entry) return;
      current = index;
      var card = entry.card;
      renderSlides(index);

      video.src = card.dataset.src;
      video.poster = card.dataset.poster || "";
      video.currentTime = 0;
      if (bar) bar.style.width = "0%";
      video.muted = muted;
      // Opening is a click, so sound is allowed; if the browser still
      // refuses, start muted instead.
      video.play().catch(function () {
        setMuted(true);
        video.play().catch(function () {});
      });

      var url = card.dataset.permalink;
      permalink.hidden = !url;
      if (url) permalink.href = url;

      var template = card.querySelector("template[data-insta-details]");
      slot.replaceChildren();
      if (template) slot.appendChild(template.content.cloneNode(true));
      // Narrow screens show the same account + details over the video.
      overlay.replaceChildren();
      Array.prototype.forEach.call(side.children, function (child) {
        overlay.appendChild(child.cloneNode(true));
      });

      // The strip loops, so there's always a previous and next post.
      prevBtn.disabled = cards.length < 2;
      nextBtn.disabled = cards.length < 2;
    }

    function go(step) {
      if (!embla) return;
      if (step < 0) embla.scrollPrev();
      else embla.scrollNext();
    }

    // One mouse-wheel / trackpad swipe moves one post: Embla doesn't handle
    // the wheel, and a trackpad fires dozens of events per swipe.
    var wheelDelta = 0;
    var wheelLocked = false;
    stage.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        if (wheelLocked) return;
        wheelDelta += e.deltaY;
        if (Math.abs(wheelDelta) < 40) return;
        go(wheelDelta);
        wheelDelta = 0;
        wheelLocked = true;
        setTimeout(function () {
          wheelLocked = false;
        }, 500);
      },
      { passive: false },
    );

    video.addEventListener("click", function () {
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });
    video.addEventListener("play", function () {
      dialog.classList.remove("is-paused");
    });
    video.addEventListener("pause", function () {
      dialog.classList.add("is-paused");
    });
    video.addEventListener("timeupdate", function () {
      if (bar && video.duration) {
        bar.style.width = (video.currentTime / video.duration) * 100 + "%";
      }
    });

    muteBtn.addEventListener("click", function () {
      setMuted(!muted);
    });
    prevBtn.addEventListener("click", function () {
      go(-1);
    });
    nextBtn.addEventListener("click", function () {
      go(1);
    });
    closeBtn.addEventListener("click", function () {
      dialog.close();
    });

    shareBtn.addEventListener("click", function () {
      var url = permalink.hidden ? video.src : permalink.href;
      var label = shareBtn.querySelector(".insta-dialog__action-label");
      if (navigator.share) {
        navigator.share({ url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          label.textContent = "Copied";
          setTimeout(function () {
            label.textContent = "Share";
          }, 1500);
        });
      }
    });

    // Captions expand on click (event delegation: they're re-cloned per post).
    dialog.addEventListener("click", function (e) {
      var caption = e.target.closest("[data-insta-caption]");
      if (caption) {
        caption.classList.toggle("is-expanded");
        return;
      }
      // A click on the empty dark area closes, like shadcn's overlay.
      if (
        e.target === dialog ||
        e.target.classList.contains("insta-dialog__layout")
      ) {
        dialog.close();
      }
    });

    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    });

    dialog.addEventListener("close", function () {
      video.pause();
      video.removeAttribute("src");
      video.load();
      current = -1;
    });

    return function openPost(index) {
      // Stop the carousel's own previews while the dialog plays.
      cards.forEach(function (c) {
        c.video.pause();
      });
      setMuted(false);
      if (!dialog.open) dialog.showModal();

      if (!embla && window.EmblaCarousel) {
        buildSlides();
        embla = window.EmblaCarousel(stage, {
          axis: "y",
          loop: true,
          startIndex: index,
        });
        embla.on("select", function () {
          var selected = embla.selectedScrollSnap();
          if (selected !== current) show(selected);
        });
      } else if (embla) {
        // Re-measure after being hidden, then jump straight to the post.
        embla.reInit();
        embla.scrollTo(index, true);
      }
      show(index);
    };
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

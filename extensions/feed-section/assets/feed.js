(function () {
  // When media auto play is on, videos loop just the first few seconds as a
  // teaser until the card is hovered — same as PREVIEW_SECONDS in PostCard.
  var PREVIEW_SECONDS = 3;

  // ---- Feed metrics ----------------------------------------------------
  // Published as custom customer events; the app's web pixel
  // (extensions/ordinary-feeds-pixel) forwards them to the app. Shopify applies the
  // shopper's privacy consent there. Nothing is sent from the theme editor.
  var EVENT_PREFIX = "ordinary_feeds:";

  function track(type, data) {
    if (window.Shopify && window.Shopify.designMode) return;
    var analytics = window.Shopify && window.Shopify.analytics;
    if (!analytics || typeof analytics.publish !== "function") return;
    try {
      analytics.publish(EVENT_PREFIX + type, data);
    } catch (err) {
      // Metrics must never break the feed.
    }
  }

  // Hidden line item properties (the leading underscore keeps them out of
  // the cart and checkout UI) that tie the line to the feed and post it was
  // added from. The web pixel reads them back on checkout_completed to
  // attribute the order's revenue.
  function attributionProperties(button) {
    var data = eventData(button);
    var props = {};
    if (data.feed_id) props._ordinary_feeds_feed = data.feed_id;
    if (data.post_id) props._ordinary_feeds_post = data.post_id;
    return props;
  }

  // Impressions and video views count once per page view.
  var trackedOnce = {};
  function trackOnce(key, type, data) {
    if (trackedOnce[key]) return;
    trackedOnce[key] = true;
    track(type, data);
  }

  // Feed, post and product ids for an event, read from the markup:
  // `data-feed-id` on the block root, `data-ordinary-feeds-post` / `data-post-id` and
  // `data-ordinary-feeds-product` (numeric product id) on the element.
  function eventData(el, postId) {
    var root = el && el.closest("[data-ordinary-feeds-root]");
    var productId = el && el.dataset.ordinaryFeedsProduct;
    return {
      feed_id: (root && root.dataset.feedId) || null,
      post_id: postId || (el && el.dataset.ordinaryFeedsPost) || null,
      product_id: productId ? "gid://shopify/Product/" + productId : null,
    };
  }

  var CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  // Shopify's standard storefront events (what themes like Horizon import as
  // `@shopify/events`). Loaded on first use; null if it can't be loaded.
  var STANDARD_EVENTS_URL =
    "https://cdn.shopify.com/storefront/standard-events.js";
  var standardEvents = null;

  function loadStandardEvents() {
    if (!standardEvents) {
      standardEvents = import(STANDARD_EVENTS_URL).catch(function (err) {
        console.warn("[ordinary-feeds] standard events unavailable", err);
        return null;
      });
    }
    return standardEvents;
  }

  function rootUrl() {
    return (
      (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
      "/"
    );
  }

  function readCart() {
    return fetch(rootUrl() + "cart.js", {
      headers: { Accept: "application/json" },
    }).then(function (res) {
      return res.json();
    });
  }

  // Adds one of the variant on `button` with the Ajax Cart API, announcing it
  // with the standard `shopify:cart:lines-update` event the same way a
  // theme's own product form does: dispatched before the request, carrying a
  // promise that resolves with the updated cart. The theme's cart icon (and
  // anything else listening) updates from that. Used by the post dialog and
  // the tagged product on each feed card.
  function addToCart(button) {
    var icon = button.innerHTML;
    var label = button.getAttribute("aria-label");
    var variantId = button.dataset.ordinaryFeedsAddToCart;
    button.disabled = true;

    loadStandardEvents().then(function (events) {
      var LinesUpdate = events && events.CartLinesUpdateEvent;
      var deferred = LinesUpdate ? LinesUpdate.createPromise() : null;

      if (deferred) {
        button.dispatchEvent(
          new LinesUpdate({
            action: "add",
            context: "product",
            lines: [{ merchandiseId: variantId, quantity: 1 }],
            promise: deferred.promise,
          }),
        );
      }

      // Resolves the event's promise with the cart as it now stands.
      function settle(didError) {
        if (!deferred) return Promise.resolve();
        return readCart().then(
          function (cart) {
            deferred.resolve({
              cart: LinesUpdate.createCartFromAjaxResponse(cart),
              detail: {
                items: cart.items,
                source: "ordinary-feeds",
                sourceId: "ordinary-feeds",
                itemCount: 1,
                didError: didError,
              },
            });
          },
          function (err) {
            // The add itself is settled either way; only listeners hear this.
            deferred.reject(err);
          },
        );
      }

      return fetch(rootUrl() + "cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: Number(variantId),
              quantity: 1,
              properties: attributionProperties(button),
            },
          ],
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              return settle(true).then(function () {
                throw new Error(data.description || "Couldn't add to cart");
              });
            }
            return data;
          });
        })
        .then(function (added) {
          button.innerHTML = CHECK_ICON;
          button.setAttribute("aria-label", "Added to cart");
          setTimeout(function () {
            button.innerHTML = icon;
            button.setAttribute("aria-label", label);
            button.disabled = false;
          }, 1500);
          document.dispatchEvent(
            new CustomEvent("ordinary-feeds:cart-added", { detail: added }),
          );
          var data = eventData(button);
          data.variant_id = variantId;
          track("add_to_cart", data);
          return settle(false);
        })
        .catch(function (err) {
          if (deferred) deferred.reject(err);
          console.error("[ordinary-feeds] add to cart failed", err);
          button.disabled = false;
          alert(err.message);
        });
    });
  }

  // Scrolling for a carousel block. Cards, the dialog and metrics are wired
  // by initFeed, same as for the grid.
  function initCarousel(root) {
    var viewport = root.querySelector(".ordinary-feeds-carousel__viewport");
    var prevBtn = root.querySelector(".ordinary-feeds-carousel__btn--prev");
    var nextBtn = root.querySelector(".ordinary-feeds-carousel__btn--next");
    if (!viewport) return;

    var loop = root.dataset.loop === "true";
    var autoScroll = root.dataset.autoScroll === "true";
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

    var dialog = root.querySelector("[data-ordinary-feeds-dialog]");

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
  }

  // "Load more" for a grid block: the block renders every post up to the
  // gallery's limit and hides all but the first batch (columns x rows), like
  // app/components/feed-grid.jsx. Each click reveals one more batch.
  function initGrid(root) {
    var more = root.querySelector("[data-ordinary-feeds-load-more]");
    if (!more) return;
    var batch = parseInt(root.dataset.batch, 10) || 1;
    var wrap = more.closest(".ordinary-feeds-grid__more") || more;

    more.addEventListener("click", function () {
      var hidden = root.querySelectorAll("[data-ordinary-feeds-card][hidden]");
      for (var i = 0; i < batch && i < hidden.length; i++) {
        hidden[i].hidden = false;
        // initFeed holds back the teaser loop for hidden cards.
        if (root.dataset.mediaAutoPlay === "true") {
          var video = hidden[i].querySelector("[data-ordinary-feeds-video]");
          if (video) video.play().catch(function () {});
        }
      }
      if (hidden.length <= batch) wrap.remove();
    });
  }

  // Wiring every feed block shares: impression, cards, post clicks, dialog.
  function initFeed(root) {
    var mediaAutoPlay = root.dataset.mediaAutoPlay === "true";
    var dialog = root.querySelector("[data-ordinary-feeds-dialog]");

    // Impression: the feed is at least half on screen, once per page view.
    if ("IntersectionObserver" in window) {
      var seen = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            seen.disconnect();
            trackOnce(
              "impression:" + (root.dataset.feedId || ""),
              "impression",
              eventData(root),
            );
          });
        },
        { threshold: 0.5 },
      );
      seen.observe(root);
    }

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

    // What a click on a post does, from the Settings page's "Post clicks"
    // (`click.action`). Each action falls back to the next one that the post
    // supports: product -> Instagram -> popup.
    var clickAction = root.dataset.clickAction || "popup";

    function onPostClick(entry) {
      if (clickAction === "none") return;
      track("post_click", eventData(entry.card, entry.card.dataset.postId));

      var data = entry.card.dataset;
      if (clickAction === "product" && data.productUrl) {
        window.location.href = data.productUrl;
        return;
      }
      if (
        (clickAction === "product" || clickAction === "instagram") &&
        data.permalink
      ) {
        window.open(data.permalink, "_blank", "noopener");
        return;
      }
      if (openPost) openPost(cards.indexOf(entry));
    }

    root
      .querySelectorAll("[data-ordinary-feeds-card]")
      .forEach(function (card) {
        var video = card.querySelector("[data-ordinary-feeds-video]");
        if (!video) return;
        var bar = card.querySelector("[data-ordinary-feeds-progress]");
        var muteBtn = card.querySelector("[data-ordinary-feeds-mute]");
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

        card.addEventListener("click", function (e) {
          // The tagged product overlay: its cart button adds straight to the
          // cart, and its link goes to the product page, neither opens the post.
          var add = e.target.closest("[data-ordinary-feeds-add-to-cart]");
          if (add) {
            e.preventDefault();
            if (!add.disabled) addToCart(add);
            return;
          }
          var link = e.target.closest("[data-ordinary-feeds-product-link]");
          if (link) {
            track("product_click", eventData(link));
            return;
          }
          onPostClick(entry);
        });

        video.addEventListener("timeupdate", function () {
          if (!video.duration) return;
          // While previewing (auto play on, not hovered), loop just the teaser
          // and keep the progress bar hidden.
          if (mediaAutoPlay && !entry.hovering) {
            if (video.currentTime >= PREVIEW_SECONDS) video.currentTime = 0;
            return;
          }
          // A view: watched past the teaser length on purpose (hovered, or
          // played with auto play off).
          if (video.currentTime >= PREVIEW_SECONDS) {
            var postId = card.dataset.postId;
            trackOnce("view:" + postId, "video_view", eventData(card, postId));
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

        if (mediaAutoPlay && !card.hidden) video.play().catch(function () {});
      });
  }

  // Wires the block's post dialog (see snippets/ordinary-feeds-dialog.liquid) and
  // returns `openPost(index)`. `cards` is the feed's card list, filled in
  // after this runs; each entry's `card` holds the post's data attributes and
  // its <template data-ordinary-feeds-details>.
  function setupDialog(dialog, cards) {
    var video = dialog.querySelector("[data-ordinary-feeds-dialog-video]");
    var stage = dialog.querySelector("[data-ordinary-feeds-dialog-stage]");
    var track = dialog.querySelector("[data-ordinary-feeds-dialog-track]");
    var bar = dialog.querySelector("[data-ordinary-feeds-dialog-progress]");
    var muteBtn = dialog.querySelector("[data-ordinary-feeds-dialog-mute]");
    var prevBtn = dialog.querySelector("[data-ordinary-feeds-dialog-prev]");
    var nextBtn = dialog.querySelector("[data-ordinary-feeds-dialog-next]");
    var closeBtn = dialog.querySelector("[data-ordinary-feeds-dialog-close]");
    var shareBtn = dialog.querySelector("[data-ordinary-feeds-dialog-share]");
    var permalink = dialog.querySelector(
      "[data-ordinary-feeds-dialog-permalink]",
    );
    var likes = dialog.querySelector("[data-ordinary-feeds-dialog-likes]");
    var likesCount = dialog.querySelector(
      "[data-ordinary-feeds-dialog-likes-count]",
    );
    // 30412 -> "30.4K": stored exact, shortened for display.
    var compact = new Intl.NumberFormat(document.documentElement.lang || "en", {
      notation: "compact",
      maximumFractionDigits: 1,
    });
    var side = dialog.querySelector("[data-ordinary-feeds-info]");
    var slot = dialog.querySelector("[data-ordinary-feeds-details-slot]");
    var overlay = dialog.querySelector("[data-ordinary-feeds-info-overlay]");
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
        slide.className = "ordinary-feeds-dialog__slide";
        track.appendChild(slide);
        return slide;
      });
    }

    function renderSlides(index) {
      slides.forEach(function (slide, i) {
        if (i === index) {
          var poster = slide.querySelector(".ordinary-feeds-dialog__poster");
          if (poster) poster.remove();
          slide.appendChild(video);
          return;
        }
        // The strip loops: the last post's neighbour is the first.
        var d = Math.abs(i - index);
        var near = Math.min(d, slides.length - d) <= NEIGHBOURS;
        var img = slide.querySelector(".ordinary-feeds-dialog__poster");
        var src = cards[i].card.dataset.poster;
        if (near && src && !img) {
          img = document.createElement("img");
          img.className = "ordinary-feeds-dialog__poster";
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

      // Empty when the owner hides likes or the post hasn't synced it yet.
      var likeCount = parseInt(card.dataset.likes, 10);
      likes.hidden = isNaN(likeCount);
      if (!likes.hidden) {
        likesCount.textContent = compact.format(likeCount);
        likes.setAttribute("aria-label", likeCount + " likes");
      }

      var url = card.dataset.permalink;
      permalink.hidden = !url;
      if (url) permalink.href = url;

      var template = card.querySelector(
        "template[data-ordinary-feeds-details]",
      );
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
    // A view in the dialog counts like one on the card (once per post).
    video.addEventListener("timeupdate", function () {
      var entry = cards[current];
      if (!entry || video.currentTime < PREVIEW_SECONDS) return;
      var postId = entry.card.dataset.postId;
      trackOnce("view:" + postId, "video_view", eventData(entry.card, postId));
    });
    // timeupdate only fires ~4 times a second, so the bar is redrawn every
    // frame while the video plays, and once more whenever it stops or seeks.
    var progressFrame = 0;
    function drawProgress() {
      if (bar && video.duration) {
        bar.style.width = (video.currentTime / video.duration) * 100 + "%";
      }
    }
    function tickProgress() {
      drawProgress();
      progressFrame = requestAnimationFrame(tickProgress);
    }
    function stopProgress() {
      cancelAnimationFrame(progressFrame);
      progressFrame = 0;
      drawProgress();
    }

    video.addEventListener("play", function () {
      dialog.classList.remove("is-paused");
    });
    video.addEventListener("pause", function () {
      dialog.classList.add("is-paused");
    });
    video.addEventListener("playing", function () {
      cancelAnimationFrame(progressFrame);
      progressFrame = requestAnimationFrame(tickProgress);
    });
    video.addEventListener("pause", stopProgress);
    video.addEventListener("waiting", stopProgress);
    video.addEventListener("seeked", drawProgress);

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
      var label = shareBtn.querySelector(
        ".ordinary-feeds-dialog__action-label",
      );
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
      var add = e.target.closest("[data-ordinary-feeds-add-to-cart]");
      if (add) {
        e.preventDefault();
        if (!add.disabled) addToCart(add);
        return;
      }
      var productLink = e.target.closest("a[data-ordinary-feeds-product]");
      if (productLink) {
        track("product_click", eventData(productLink));
        return;
      }
      var caption = e.target.closest("[data-ordinary-feeds-caption]");
      if (caption) {
        caption.classList.toggle("is-expanded");
        return;
      }
      // A click on the empty dark area closes, like shadcn's overlay.
      if (
        e.target === dialog ||
        e.target.classList.contains("ordinary-feeds-dialog__layout")
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
      // Stop the feed's own previews while the dialog plays.
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

  function init(root) {
    if (root.dataset.ordinaryFeedsInitialized) return;
    // The carousel and the post dialog both need Embla; the deferred script
    // may not have run yet on the first pass, so try again on the next.
    if (!window.EmblaCarousel) return;
    root.dataset.ordinaryFeedsInitialized = "true";

    if (root.hasAttribute("data-ordinary-feeds-carousel")) initCarousel(root);
    if (root.hasAttribute("data-ordinary-feeds-grid")) initGrid(root);
    initFeed(root);
  }

  function initAll() {
    document.querySelectorAll("[data-ordinary-feeds-root]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  document.addEventListener("shopify:section:load", initAll);
  document.addEventListener("shopify:block:select", initAll);
})();

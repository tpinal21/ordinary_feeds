// `s-app-window` content renders in a sibling iframe created by admin, so the
// route inside it can't reach the element (or `shopify.modal.hide`, which looks
// the id up in its own document). Both frames are same-origin, so the content
// broadcasts a close request and the frame owning the element hides it.
export const APP_WINDOW_CHANNEL = "app-window";

export function requestAppWindowClose(id) {
  const channel = new BroadcastChannel(APP_WINDOW_CHANNEL);
  channel.postMessage({ type: "close", id });
  channel.close();
}

import { authenticate, sessionStorage } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  if (session) {
    const current = payload.current;
    session.scope = current.toString();
    await sessionStorage.storeSession(session);
  }

  return new Response();
};

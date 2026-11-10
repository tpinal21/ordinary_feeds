// Shared helpers for the `api.*` resource routes.

export function badRequest(error) {
  return Response.json({ success: false, error }, { status: 400 });
}

// Parses the JSON request body. On malformed JSON it throws a 400 Response,
// which React Router sends back as-is from a resource route, so callers can
// just `const payload = await readJsonBody(request);`.
export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw badRequest("invalid_json");
  }
}

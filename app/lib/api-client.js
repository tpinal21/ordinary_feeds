export async function apiFetch(
  url,
  { body, method = "GET", headers, ...options } = {},
) {
  const hasBody = body !== undefined;

  const res = await fetch(url, {
    ...options,
    method: method,
    headers: {
      ...(hasBody && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(hasBody && { body: JSON.stringify(body) }),
  });

  return res.json();
}

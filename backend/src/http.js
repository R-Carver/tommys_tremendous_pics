// Small response helpers.

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function errorResponse(status, message) {
  return json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function GET(): Response {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Access denied</title></head><body><main><h1>Access denied</h1><p>Your current organisation role cannot access this page.</p><a href="/">Return to the portal</a></main></body></html>',
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

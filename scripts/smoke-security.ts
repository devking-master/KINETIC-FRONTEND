// Security smoke test: runs the API without a database and checks tokens, CSRF guard, CORS, cookies and uploads.
// Run: npm run test:smoke
import jwt from 'jsonwebtoken';
process.env.NODE_ENV = 'test';
process.env.CLOUDINARY_CLOUD_NAME = 'democloud';
process.env.CLOUDINARY_API_KEY = '123456';
process.env.CLOUDINARY_API_SECRET = 'testsecret';
process.env.FRONTEND_URL = 'https://app.example.com/';
process.env.COOKIE_SAMESITE = 'none';
process.env.JWT_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);

const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, extra?: string) => { results.push([name, ok, extra]); };

const main = async () => {
  const { default: app } = await import('../server/index');
  const { signAccessToken } = await import('../server/utils/tokens');
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${(srv.address() as any).port}/api`;
  const ORIGIN = 'https://app.example.com';
  const H = { Origin: ORIGIN, 'X-Kinetic-Client': 'web' };
  const j = async (r: Response) => ({ status: r.status, body: await r.json().catch(() => ({})), headers: r.headers });

  let r = await j(await fetch(`${base}/health`));
  check('health ok', r.status === 200 && r.body.platform === 'Kinetic Backend');

  r = await j(await fetch(`${base}/does-not-exist`));
  check('unknown /api route -> JSON 404', r.status === 404 && r.body.message === 'Route not found');

  r = await j(await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } }));
  check('CORS: evil origin blocked with 403 + requestId, no internals', r.status === 403 && !!r.body.requestId && !JSON.stringify(r.body).includes('Error:'), JSON.stringify(r.body));

  r = await j(await fetch(`${base}/health`, { headers: { Origin: ORIGIN } }));
  check('CORS: allowed origin (trailing slash in env) accepted', r.status === 200);

  r = await j(await fetch(`${base}/auth/refresh`, { method: 'POST' }));
  check('refresh without Origin/header -> 403', r.status === 403);
  r = await j(await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { Origin: ORIGIN } }));
  check('refresh without X-Kinetic-Client -> 403', r.status === 403);
  r = await j(await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { Origin: 'https://evil.example', 'X-Kinetic-Client': 'web' } }));
  check('refresh from evil origin -> 403', r.status === 403);
  r = await j(await fetch(`${base}/auth/refresh`, { method: 'POST', headers: H }));
  check('refresh with good headers but no cookie -> 401', r.status === 401);

  r = await j(await fetch(`${base}/auth/logout`, { method: 'POST', headers: H }));
  const setCookie = r.headers.get('set-cookie') || '';
  check('logout works with no/expired token and clears cookie', r.status === 200 && /refreshToken=;/.test(setCookie), setCookie);
  check('clear-cookie keeps Path=/api/auth; SameSite=None; Secure (browser will honor it)', /Path=\/api\/auth/i.test(setCookie) && /SameSite=None/i.test(setCookie) && /Secure/i.test(setCookie), setCookie);
  r = await j(await fetch(`${base}/auth/logout`, { method: 'POST' }));
  check('logout without CSRF headers -> 403', r.status === 403);

  const old = jwt.sign({ id: 'x', email: 'a@b.c', username: 'u', role: 'admin' }, 'kinetic-super-secret-key-2026', { expiresIn: '1h' });
  r = await j(await fetch(`${base}/upload/signature?kind=avatar`, { headers: { Authorization: `Bearer ${old}` } }));
  check('token signed with the OLD fallback secret -> 401', r.status === 401);
  const none = jwt.sign({ id: 'x' }, '', { algorithm: 'none' as any });
  r = await j(await fetch(`${base}/upload/signature?kind=avatar`, { headers: { Authorization: `Bearer ${none}` } }));
  check('alg=none token -> 401', r.status === 401);
  const refreshAsAccess = jwt.sign({ id: 'x', tokenVersion: 0 }, 'b'.repeat(48), { expiresIn: '1h' });
  r = await j(await fetch(`${base}/upload/signature?kind=avatar`, { headers: { Authorization: `Bearer ${refreshAsAccess}` } }));
  check('refresh-secret token cannot be used as access token -> 401', r.status === 401);

  const good = signAccessToken({ id: 'user123', email: 'a@b.c', username: 'u', role: 'creator' });
  r = await j(await fetch(`${base}/upload/signature?kind=bogus`, { headers: { Authorization: `Bearer ${good}` } }));
  check('signature: unknown kind -> 400', r.status === 400);
  r = await j(await fetch(`${base}/upload/signature?folder=anything`, { headers: { Authorization: `Bearer ${good}` } }));
  check('signature: client-chosen folder without kind -> 400', r.status === 400);
  r = await j(await fetch(`${base}/upload/signature?kind=video&folder=../../other`, { headers: { Authorization: `Bearer ${good}` } }));
  check('signature: folder is fixed per user, client folder ignored', r.status === 200 && r.body.folder === 'kinetic/video/user123' && /mp4/.test(r.body.allowed_formats), JSON.stringify({ folder: r.body.folder, f: r.body.allowed_formats }));

  r = await j(await fetch(`${base}/upload/video`, { method: 'POST', headers: { Authorization: `Bearer ${good}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: 'x', videoUrl: 'https://evil.example/v.mp4', cloudinaryPublicId: 'kinetic/video/user123/a', duration: 10 }) }));
  check('publish video with non-Cloudinary URL -> 400 (schema)', r.status === 400);
  r = await j(await fetch(`${base}/upload/video`, { method: 'POST', headers: { Authorization: `Bearer ${good}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: 'x', videoUrl: 'https://res.cloudinary.com/othercloud/video/upload/v1/a.mp4', cloudinaryPublicId: 'kinetic/video/user123/a', duration: 10 }) }));
  check('publish video from ANOTHER Cloudinary account -> 400', r.status === 400);

  srv.close();
  let failed = 0;
  for (const [n, ok, extra] of results) { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && extra ? '   -> ' + extra : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};
main().catch((e) => { console.error('smoke crashed:', e); process.exit(2); });

import { randomUUID } from 'crypto';

export function getClientId(req, res) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)cid=([^;]+)/);
  let cid = m ? decodeURIComponent(m[1]) : null;

  if (!cid) {
    cid = 'u_' + randomUUID().replace(/-/g, '').slice(0, 12);
    res.setHeader(
      'Set-Cookie',
      `cid=${encodeURIComponent(cid)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
    );
  }
  return cid;
}

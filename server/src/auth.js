import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '12h';

export function signToken({ name, role }) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  return jwt.sign({ name, role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  return jwt.verify(token, JWT_SECRET);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해 주세요' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다' });
  next();
}

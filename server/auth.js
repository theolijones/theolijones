import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---------------------------------------------------------------------------
// authenticate – verify JWT from the "token" cookie
// ---------------------------------------------------------------------------

export function authenticate(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    console.log('[AUTH] No token cookie present');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;          // { id, email, role, name }
    next();
  } catch (err) {
    console.log('[AUTH] Invalid or expired token:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// adminOnly – must run after authenticate
// ---------------------------------------------------------------------------

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    console.log(`[AUTH] Admin access denied for user ${req.user?.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

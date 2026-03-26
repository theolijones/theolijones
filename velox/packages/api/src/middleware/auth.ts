import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { AuthUser } from '@velox/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const COGNITO_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';

const client = jwksClient({
  jwksUri: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!header.kid) {
    callback(new Error('No kid in token header'));
    return;
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  // In development, allow a bypass token
  if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
    req.user = {
      id: 'dev-user',
      email: 'dev@velox.local',
      name: 'Dev User',
      groups: ['admin'],
    };
    next();
    return;
  }

  jwt.verify(
    token,
    getKey,
    {
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }

      const payload = decoded as jwt.JwtPayload;
      req.user = {
        id: payload.sub || '',
        email: payload.email || '',
        name: payload.name || payload.email || '',
        groups: payload['cognito:groups'] || [],
      };

      next();
    }
  );
}

export function requireGroup(...groups: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const hasGroup = groups.some((g) => req.user!.groups.includes(g));
    if (!hasGroup) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

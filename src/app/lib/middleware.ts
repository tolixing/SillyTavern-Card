import { NextRequest } from 'next/server';
import { AuthService } from './auth';

export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function verifyAuth(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) {
    return { isValid: false, user: null, error: 'No token provided' };
  }

  const user = AuthService.verifyToken(token);
  if (!user) {
    return { isValid: false, user: null, error: 'Invalid token' };
  }

  return { isValid: true, user, error: null };
}

export function requireAuth(request: NextRequest) {
  const authResult = verifyAuth(request);
  if (!authResult.isValid) {
    throw new Error(authResult.error || 'Authentication required');
  }
  return authResult.user!;
}
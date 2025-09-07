import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 明确类型以匹配 jsonwebtoken@9 的重载签名
const JWT_SECRET: Secret = (process.env.JWT_SECRET || 'fallback-secret-key') as Secret;
const JWT_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN as unknown as SignOptions['expiresIn']) || '24h';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export interface AuthUser {
  username: string;
  isAdmin: boolean;
}

export class AuthService {
  static async validateCredentials(username: string, password: string): Promise<boolean> {
    return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
  }

  static generateToken(user: AuthUser): string {
    const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
    return jwt.sign(user, JWT_SECRET, options);
  }

  static verifyToken(token: string): AuthUser | null {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthUser;
    } catch {
      return null;
    }
  }

  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}

export function getAdminUser(): AuthUser {
  return {
    username: ADMIN_USERNAME,
    isAdmin: true
  };
}

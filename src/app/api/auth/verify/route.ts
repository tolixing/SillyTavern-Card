import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    
    if (!authResult.isValid) {
      return NextResponse.json(
        { message: authResult.error || 'Token无效' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: {
        username: authResult.user!.username,
        isAdmin: authResult.user!.isAdmin
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { message: 'Token验证失败' },
      { status: 500 }
    );
  }
}
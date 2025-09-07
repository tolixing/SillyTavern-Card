import { NextRequest, NextResponse } from 'next/server';
import { AuthService, getAdminUser } from '../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const isValid = await AuthService.validateCredentials(username, password);
    if (!isValid) {
      return NextResponse.json(
        { message: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const user = getAdminUser();
    const token = AuthService.generateToken(user);

    return NextResponse.json({
      message: '登录成功',
      token,
      user: {
        username: user.username,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
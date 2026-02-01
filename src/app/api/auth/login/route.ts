import { NextRequest, NextResponse } from 'next/server';

// Admin credentials — move to env vars in production
const USERS: Record<string, string> = {
  nick: process.env.ADMIN_PASS_NICK || 'Claxton!Nick2026',
  rick: process.env.ADMIN_PASS_RICK || 'Claxton!Rick2026',
};

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const user = username?.toLowerCase();
    if (!user || !USERS[user]) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (password !== USERS[user]) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Set auth cookie (httpOnly, 7 day expiry)
    const response = NextResponse.json({ success: true, user });
    response.cookies.set('claxton_auth', JSON.stringify({ user, ts: Date.now() }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('claxton_auth');
  if (!cookie?.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const data = JSON.parse(cookie.value);
    return NextResponse.json({ authenticated: true, user: data.user });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

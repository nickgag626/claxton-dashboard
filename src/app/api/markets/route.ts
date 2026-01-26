import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  
  try {
    const cmd = query 
      ? `cd /home/ubuntu/clawd && python3 scripts/kalshi.py search "${query}"`
      : `cd /home/ubuntu/clawd && python3 scripts/kalshi.py search`;
    
    const { stdout } = await execAsync(cmd);
    
    // Parse events from output
    const events: { ticker: string; title: string; subtitle?: string }[] = [];
    const lines = stdout.split('\n');
    
    let currentEvent: { ticker: string; title: string; subtitle?: string } | null = null;
    
    for (const line of lines) {
      if (line.startsWith('🎯 ')) {
        if (currentEvent) events.push(currentEvent);
        currentEvent = { ticker: line.replace('🎯 ', '').trim(), title: '' };
      } else if (currentEvent && line.startsWith('   ') && !currentEvent.title) {
        currentEvent.title = line.trim();
      } else if (currentEvent && line.startsWith('   (')) {
        currentEvent.subtitle = line.trim().replace(/[()]/g, '');
      }
    }
    if (currentEvent) events.push(currentEvent);
    
    return NextResponse.json({ events: events.slice(0, 20) });
  } catch (error) {
    console.error('Markets fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}

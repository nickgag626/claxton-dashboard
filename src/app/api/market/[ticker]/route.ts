import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  
  try {
    const { stdout } = await execAsync(
      `cd /home/ubuntu/clawd && python3 scripts/kalshi.py market "${ticker}"`
    );
    
    // Parse market data
    const lines = stdout.split('\n');
    const market: Record<string, string | number> = { ticker };
    
    for (const line of lines) {
      if (line.includes('Yes Bid/Ask:')) {
        const match = line.match(/(\d+)¢ \/ (\d+)¢/);
        if (match) {
          market.yesBid = parseInt(match[1]);
          market.yesAsk = parseInt(match[2]);
        }
      } else if (line.includes('No Bid/Ask:')) {
        const match = line.match(/(\d+)¢ \/ (\d+)¢/);
        if (match) {
          market.noBid = parseInt(match[1]);
          market.noAsk = parseInt(match[2]);
        }
      } else if (line.includes('Volume:')) {
        const match = line.match(/\$([0-9,]+)/);
        if (match) market.volume = parseInt(match[1].replace(',', ''));
      } else if (line.includes('Open Interest:')) {
        const match = line.match(/Open Interest: (\d+)/);
        if (match) market.openInterest = parseInt(match[1]);
      } else if (line.includes('Status:')) {
        market.status = line.split('Status:')[1].trim();
      } else if (line.trim() && !line.startsWith('📌') && !line.includes('Bid/Ask')) {
        if (!market.title) market.title = line.trim();
      }
    }
    
    return NextResponse.json(market);
  } catch (error) {
    console.error('Market fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch market' }, { status: 500 });
  }
}

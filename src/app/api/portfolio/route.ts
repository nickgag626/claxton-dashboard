import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout } = await execAsync('cd /home/ubuntu/clawd && python3 scripts/kalshi.py portfolio');
    
    // Parse the output
    const lines = stdout.trim().split('\n');
    const balanceLine = lines.find(l => l.includes('Balance:'));
    const balance = balanceLine ? parseFloat(balanceLine.match(/\$([0-9.]+)/)?.[1] || '0') : 0;
    
    // Check for positions
    const hasPositions = !stdout.includes('Positions: None');
    
    return NextResponse.json({
      balance,
      hasPositions,
      raw: stdout
    });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}

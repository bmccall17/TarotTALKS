/**
 * Instagram Image Route Handler for Talks
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Super minimal test - just return a simple image
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          color: '#ffffff',
          fontSize: 48,
        }}
      >
        <div>Talk Instagram Test</div>
        <div style={{ fontSize: 24, marginTop: 20 }}>{slug}</div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/app/lib/verifyAuth';
import { docClient } from '@/app/lib/dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

// 3 second timeout for fetch
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = 3000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
};

export async function GET(request: NextRequest) {
  try {
    // 1. Check edge platform country headers (Vercel & Cloudflare)
    // Vercel populates 'x-vercel-ip-country' reliably with the 2-letter ISO code
    const vercelCountry = request.headers.get('x-vercel-ip-country')?.toUpperCase();
    const cfCountry = request.headers.get('cf-ipcountry')?.toUpperCase();
    const edgeCountry = vercelCountry || cfCountry;

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    
    let ip: string | null = null;
    if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp.trim();
    }

    // If edge headers directly indicate India, grant immediate access
    if (edgeCountry === 'IN') {
      return NextResponse.json({
        allowed: true,
        country: 'IN',
        isVpn: false,
        isProxy: false,
        isHosting: false,
        ip,
      });
    }

    // Local development fallback - treat as allowed
    if (
      !ip ||
      ip === '::1' ||
      ip === '127.0.0.1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.')
    ) {
      return NextResponse.json({
        allowed: true,
        country: 'IN',
        isVpn: false,
        isProxy: false,
        isHosting: false,
        ip: ip || '127.0.0.1',
      });
    }

    // 2. Call ip-api.com to detect country and proxy
    const url = `http://ip-api.com/json/${ip}?fields=status,countryCode,proxy,hosting,query`;
    
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' }, 3000);
      
      if (!res.ok) {
        throw new Error(`ip-api responded with status: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.status === 'success') {
        const country = data.countryCode?.toUpperCase();
        const isProxy = !!data.proxy;
        const isHosting = !!data.hosting;
        
        // In India, cellular networks (Jio, Airtel 5G, Vi) frequently route through
        // CGNAT and telecom datacenters that get falsely flagged as 'hosting'.
        // Genuine Indian users must NOT be blocked simply because of CGNAT hosting flags.
        const allowed = country === 'IN';
        
        return NextResponse.json({
          allowed,
          country,
          isVpn: isProxy,
          isProxy,
          isHosting,
          ip,
        });
      }
      
      throw new Error(`ip-api returned status: ${data.status}`);
    } catch (apiError) {
      console.warn('IP API check failed or rate-limited:', apiError);
      
      // If edge country was not explicitly non-India, or if rate-limited,
      // fail gracefully so genuine Indian users aren't locked out during API outages.
      return NextResponse.json({
        allowed: edgeCountry === 'IN' || !edgeCountry,
        country: edgeCountry || 'IN',
        isVpn: false,
        isProxy: false,
        isHosting: false,
        ip,
      });
    }
  } catch (error) {
    console.error('Error in GET /api/geo/verify:', error);
    return NextResponse.json({
      allowed: true,
      country: 'IN',
      isVpn: false,
      isProxy: false,
      isHosting: false,
      ip: null,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { latitude, longitude } = body;

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    // India bounding box (approximate)
    // Latitude: 6.0 to 37.5
    // Longitude: 68.0 to 97.5
    const insideIndia = (
      latitude >= 6.0 && latitude <= 37.5 &&
      longitude >= 68.0 && longitude <= 97.5
    );

    // Optional auth check to save verification status
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const user = await verifyAuth(request);
        
        if (user && user.userId) {
          await docClient.send(new UpdateCommand({
            TableName: 'InPlayer-Users',
            Key: { userId: user.userId },
            UpdateExpression: 'SET geoVerifiedAt = :time, geoVerifiedLocation = :loc',
            ExpressionAttributeValues: {
              ':time': new Date().toISOString(),
              ':loc': `${latitude},${longitude}`,
            },
          }));
        }
      } catch (authError) {
        console.warn('Failed to verify auth or update DB during geo verify:', authError);
      }
    }

    return NextResponse.json({
      allowed: insideIndia,
      insideIndia,
    });
  } catch (error) {
    console.error('Error in POST /api/geo/verify:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

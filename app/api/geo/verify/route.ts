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
    // Extract client IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    
    let ip = null;
    if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp.trim();
    }

    // Local dev fallback - treat as allowed
    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      return NextResponse.json({
        allowed: true,
        country: null,
        isVpn: false,
        isProxy: false,
        isHosting: false,
        ip: ip || 'unknown',
      });
    }

    // Call ip-api.com to detect country and VPN/proxy
    // Free tier requires HTTP
    const url = `http://ip-api.com/json/${ip}?fields=status,countryCode,proxy,hosting,query`;
    
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' }, 3000);
      
      if (!res.ok) {
        throw new Error(`ip-api responded with status: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.status === 'success') {
        const isProxy = !!data.proxy;
        const isHosting = !!data.hosting;
        const country = data.countryCode;
        
        // Allowed if in India AND not using proxy/VPN AND not from a datacenter
        const allowed = country === 'IN' && !isProxy && !isHosting;
        
        return NextResponse.json({
          allowed,
          country,
          isVpn: isProxy, // ip-api groups VPN under proxy
          isProxy,
          isHosting,
          ip,
        });
      }
      
      // If the provider returns a failure status, fail closed.
      throw new Error(`ip-api returned status: ${data.status}`);
    } catch (apiError) {
      // Fail closed: an unverified network must never be granted access.
      console.warn('IP API check failed, denying access:', apiError);
      
      return NextResponse.json({
        allowed: false,
        country: null,
        isVpn: false,
        isProxy: false,
        isHosting: false,
        ip,
      });
    }
  } catch (error) {
    console.error('Error in GET /api/geo/verify:', error);
    // Ultimate fallback also fails closed.
    return NextResponse.json({
      allowed: false,
      country: null,
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
        // verifyAuth expects the full NextRequest (it reads the
        // Authorization header internally).
        const user = await verifyAuth(request);
        
        if (user && user.userId) {
          // Update user in DynamoDB
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
        // Just log the error, don't fail the geo check if auth fails
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

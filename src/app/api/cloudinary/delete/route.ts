import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Derive the Cloudinary public_id from a secure_url */
function publicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Path looks like: /v1234567890/folder/filename.ext
    const parts = u.pathname.split('/');
    // Find the version segment (starts with 'v' followed by digits)
    const versionIdx = parts.findIndex(p => /^v\d+$/.test(p));
    if (versionIdx === -1) return null;
    // Everything after the version, minus the file extension
    const withExt = parts.slice(versionIdx + 1).join('/');
    return withExt.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const publicId = publicIdFromUrl(url);
    if (!publicId) {
      return NextResponse.json({ error: 'Could not derive public_id from URL' }, { status: 400 });
    }

    await cloudinary.uploader.destroy(publicId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cloudinary delete error:', err);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}

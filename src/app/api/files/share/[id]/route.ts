export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

function getStoragePath(): string {
  return path.resolve(process.cwd(), STORAGE_PATH);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const publicUrl = params.id;
    console.log('Share download - ID:', publicUrl);

    // Find file by public_url
    const files = await query<any[]>(
      'SELECT * FROM files WHERE public_url = ? AND is_public = 1',
      [publicUrl]
    );

    console.log('Share download - Found:', files.length > 0);

    if (!files[0]) {
      return NextResponse.json(
        { success: false, error: 'File not found or not public' },
        { status: 404 }
      );
    }

    const file = files[0];
    const filePath = path.join(getStoragePath(), file.path);
    
    console.log('Share download - File path:', filePath);

    const buffer = await fs.readFile(filePath);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_name)}"`,
        'Content-Length': file.size.toString(),
      },
    });
  } catch (error: any) {
    console.error('Share download error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
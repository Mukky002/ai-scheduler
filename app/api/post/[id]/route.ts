import { POST_STATUS } from '@/constants/post';
import { getInsforgeServerClient } from '@/lib/insforge-server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 try {
  const { id } = await params;
  const { insforge, userId } = await getInsforgeServerClient();
  if (!userId)
   return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 },
   );

  const { content, images, scheduled_at, status } =
   await request.json();

  const updateData: any = {};
  if (content) updateData.content = content;
  if (Array.isArray(images)) updateData.images = images;
  if (scheduled_at) updateData.scheduled_at = scheduled_at;
  if (status && status === POST_STATUS.DRAFT)
   updateData.status = status;

  const { data, error } = await insforge.database
   .from('scheduled_posts')
   .update(updateData)
   .eq('id', id)
   .eq('user_id', userId)
   .select()
   .single();

  if (error) {
   console.error('Error updating post:', error);
   return NextResponse.json(
    { error: 'Failed to update post' },
    { status: 500 },
   );
  }

  return NextResponse.json({ post: data });
 } catch (error) {
  console.error('Error updating post:', error);
  return NextResponse.json(
   { error: 'Internal server error' },
   { status: 500 },
  );
 }
}

export async function DELETE(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 try {
  const { id } = await params;
  const { insforge, userId } = await getInsforgeServerClient();
  if (!userId) {
   return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 },
   );
  }

  const { data: post, error: fetchError } = await insforge.database
   .from('scheduled_posts')
   .select('id, images')
   .eq('id', id)
   .eq('user_id', userId)
   .single();

  if (fetchError || !post) {
   return NextResponse.json(
    { error: 'Post not found' },
    { status: 404 },
   );
  }

  if (Array.isArray(post.images) && post.images.length > 0) {
   const imageKeys = post.images
    .map((img: { key?: string }) => img?.key)
    .filter(Boolean) as string[];

   if (imageKeys.length > 0) {
    try {
     await insforge.storage.from('fuzzy').remove(imageKeys);
    } catch (storageErr) {
     console.error('Error removing storage images for deleted post:', storageErr);
    }
   }
  }

  const { error: deleteError } = await insforge.database
   .from('scheduled_posts')
   .delete()
   .eq('id', id)
   .eq('user_id', userId);

  if (deleteError) {
   console.error('Error deleting post:', deleteError);
   return NextResponse.json(
    { error: 'Failed to delete post' },
    { status: 500 },
   );
  }

  return NextResponse.json({ success: true, id });
 } catch (error) {
  console.error('Error deleting post:', error);
  return NextResponse.json(
   { error: 'Internal server error' },
   { status: 500 },
  );
 }
}

import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { Comment, Post } from '@/lib/types';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { PostCard } from '@/components/feed/post-card';
import { Comments } from '@/components/feed/comments';

export const metadata = { title: 'Publicação' };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await requireMember();
  const [posts, comments] = await Promise.all([rpc<Post[]>('feed_page', { p_post: id }), rpc<Comment[]>('post_comments', { p_post: id })]);
  const post = posts[0];
  if (!post) notFound();
  return (
    <>
      <PageHeader title="Publicação" back="/feed" />
      <Sheet className="pt-2">
        <PostCard post={post} linkToDetail={false} />
        <Comments postId={post.id} initial={comments} canComment={!post.hidden} />
      </Sheet>
    </>
  );
}

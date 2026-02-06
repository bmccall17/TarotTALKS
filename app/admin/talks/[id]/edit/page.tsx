import { notFound } from 'next/navigation';
import { getTalkByIdForAdmin } from '@/lib/db/queries/admin-talks';
import { TalkForm } from '@/components/admin/talks/TalkForm';

export default async function EditTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalkByIdForAdmin(id);

  if (!talk) {
    notFound();
  }

  return (
    <TalkForm
      mode="edit"
      talkId={talk.id}
      talkSlug={talk.slug}
      initialData={{
        title: talk.title,
        speakerName: talk.speakerName,
        tedUrl: talk.tedUrl || '',
        youtubeUrl: talk.youtubeUrl || '',
        youtubeVideoId: talk.youtubeVideoId,
        description: talk.description || '',
        durationSeconds: talk.durationSeconds,
        year: talk.year,
        eventName: talk.eventName || '',
        thumbnailUrl: talk.thumbnailUrl || '',
        language: talk.language || 'en',
        speakerTwitterHandle: talk.speakerTwitterHandle || '',
        speakerBlueskyHandle: talk.speakerBlueskyHandle || '',
      }}
      mappings={talk.mappings}
    />
  );
}

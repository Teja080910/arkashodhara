'use client';

import PlatformView from '@/components/admin/social/PlatformView';

export default function InstagramPage() {
  return (
    <PlatformView
      platform="instagram"
      title="Instagram"
      connectPlatform="meta"
      description="Instagram publishing uses the Meta Graph API. The account must be Business or Creator and linked to the Facebook Page. Every post needs an image."
      notes={[
        'Connect uses the same Facebook OAuth flow as Facebook Page publishing.',
        'If the account is not linked to a Page, the social agent will not save an Instagram account.',
        'Publishing limit is 100 API posts per rolling 24 hours.',
        'Images are served from social.arkasodhara.tech/media.',
      ]}
    />
  );
}

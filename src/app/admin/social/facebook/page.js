'use client';

import PlatformView from '@/components/admin/social/PlatformView';

export default function FacebookPage() {
  return (
    <PlatformView
      platform="facebook"
      title="Facebook"
      connectPlatform="meta"
      description="Facebook posts go to the connected Page, not a personal profile. Instagram and Facebook share the same Meta OAuth connection."
      notes={[
        'The Facebook account used during Connect must manage the Page.',
        'If multiple Pages are returned, the social agent currently selects the first one.',
        'Personal profile posting is not supported by the Graph API.',
      ]}
    />
  );
}

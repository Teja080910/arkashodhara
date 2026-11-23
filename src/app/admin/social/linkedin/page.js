'use client';

import PlatformView from '@/components/admin/social/PlatformView';

export default function LinkedInPage() {
  return (
    <PlatformView
      platform="linkedin"
      title="LinkedIn"
      connectPlatform="linkedin"
      description="LinkedIn publishing uses the LinkedIn REST API. LinkedIn credentials still come from the social agent's environment, while account status and posts are shown here."
      notes={[
        'The social agent token expires after about 60 days; reconnect when it expires.',
        'LinkedIn supports text and single-image posts through this integration.',
        'Profile editing is not available through the API.',
      ]}
    />
  );
}

/**
 * YouTube Service
 * Handles interactions with YouTube Data API v3
 */

/**
 * Uploads a video Blob to YouTube using the Data API v3 (Multipart Upload).
 */
export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  title: string,
  description: string,
  accessToken: string,
  privacy: 'public' | 'private' | 'unlisted' = 'private',
  tags: string[] = [],
  publishAt?: string
): Promise<any> => {
  const finalPrivacy = publishAt ? 'private' : privacy;

  const metadata: any = {
    snippet: {
      title: title.substring(0, 100),
      description: description + "\n\n#Shorts #AI #AutoShorts",
      tags: [...new Set(["AutoShorts", "AI", "Shorts", "Generated", ...tags])].slice(0, 50),
      categoryId: "22"
    },
    status: {
      privacyStatus: finalPrivacy,
      selfDeclaredMadeForKids: false,
      embeddable: true
    }
  };

  if (publishAt) {
    metadata.status.publishAt = publishAt;
  }

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', videoBlob);

  try {
    const response = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorText); } catch (e) {}
      if (errorData?.error?.errors?.some((e: any) => e.reason === 'quotaExceeded') || errorText.toLowerCase().includes("quota")) {
        throw new Error("YOUTUBE_QUOTA_EXCEEDED");
      }
      throw new Error(`YouTube Upload Failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

/**
 * Fetches the authenticated user's YouTube channel profile.
 */
export const getYouTubeChannelProfile = async (accessToken: string) => {
  try {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.toLowerCase().includes("quota")) throw new Error("YOUTUBE_QUOTA_EXCEEDED");
      throw new Error(`Failed to fetch channel profile: ${response.status}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) throw new Error('No YouTube channel found.');
    return data.items[0];
  } catch (error: any) {
    throw error;
  }
};

/**
 * Fetches recent video activities for performance analysis
 */
export const getYouTubeActivities = async (accessToken: string) => {
  try {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&mine=true&maxResults=10',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        }
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch (e) {
    return [];
  }
};
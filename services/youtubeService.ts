
/**
 * YouTube Service
 * Handles interactions with YouTube Data API v3
 */

/**
 * Uploads a video Blob to YouTube using the Data API v3 (Multipart Upload).
 * Requires a valid OAuth 2.0 Access Token with 'https://www.googleapis.com/auth/youtube.upload' scope.
 */
export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  title: string,
  description: string,
  accessToken: string,
  privacy: 'public' | 'private' | 'unlisted' = 'private',
  tags: string[] = [],
  publishAt?: string // [New] ISO 8601 format timestamp
): Promise<any> => {
  
  // [Important] YouTube API requires scheduled videos to have 'private' status initially.
  // It will transition to public automatically at the scheduled time.
  const finalPrivacy = publishAt ? 'private' : privacy;

  // 1. Prepare Metadata for the video resource
  const metadata: any = {
    snippet: {
      title: title.substring(0, 100), // YouTube title limit is 100 chars
      description: description + "\n\n#Shorts #AI #AutoShorts", // Appending default tags
      tags: [...new Set(["AutoShorts", "AI", "Shorts", "Generated", ...tags])].slice(0, 50),
      categoryId: "22" // Category ID 22 is 'People & Blogs'
    },
    status: {
      privacyStatus: finalPrivacy,
      selfDeclaredMadeForKids: false,
      embeddable: true
    }
  };

  // [New] Add publishAt to status if provided
  if (publishAt) {
    metadata.status.publishAt = publishAt;
  }

  // 2. Create multipart/related request body
  const formData = new FormData();
  
  // Part A: JSON Metadata
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );

  // Part B: Video File
  formData.append('file', videoBlob);

  // 3. Perform the upload request
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
      try {
          errorData = JSON.parse(errorText);
      } catch (e) {}

      if (errorData?.error?.errors?.some((e: any) => e.reason === 'quotaExceeded') || errorText.toLowerCase().includes("quota")) {
        throw new Error("YOUTUBE_QUOTA_EXCEEDED");
      }

      console.error("YouTube Upload Error:", errorData || errorText);
      throw new Error(`YouTube Upload Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error: any) {
    if (error.message !== "YOUTUBE_QUOTA_EXCEEDED") {
      console.error("Upload process error:", error);
    }
    throw error;
  }
};

/**
 * Fetches the authenticated user's YouTube channel profile.
 * Used for displaying channel info in the dashboard.
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
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {}

      // Specifically check for quota exhaustion
      if (errorData?.error?.errors?.some((e: any) => e.reason === 'quotaExceeded') || errorText.toLowerCase().includes("quota")) {
        throw new Error("YOUTUBE_QUOTA_EXCEEDED");
      }

      throw new Error(`Failed to fetch channel profile: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('No YouTube channel found for this Google account. Please create a channel first.');
    }

    return data.items[0];
  } catch (error: any) {
    // Suppress console logging for quota errors as they are handled in the UI
    if (error.message !== "YOUTUBE_QUOTA_EXCEEDED") {
        console.error("Get Profile Error:", error);
    }
    throw error;
  }
};

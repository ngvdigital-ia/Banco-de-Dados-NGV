const VTURB_BASE_URL = "https://api.vturb.com.br"; // placeholder

export async function fetchVideoAnalytics(videoId: string) {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  // TODO: Implement when API key is available
  // Expected to return: views, playRate, retentionCurve, avgWatchTime
  // Example call:
  // const res = await fetch(`${VTURB_BASE_URL}/videos/${videoId}/analytics`, {
  //   headers: { Authorization: `Bearer ${apiKey}` },
  // });
  void VTURB_BASE_URL; // avoid unused variable warning

  return null;
}

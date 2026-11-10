// Server-side social feeds (frontend-owned). Only import from Server Components / server code:
// fetches go out from the server so readers' browsers never load third-party scripts.
export type { SocialFeed, SocialPost } from './types'
export { YOUTUBE_CHANNEL_URL, getYouTubeLatest, getYouTubeShorts, getYouTubeVideos } from './youtube'

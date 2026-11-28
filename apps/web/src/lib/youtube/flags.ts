/** Hard kill switch for YouTube Studio (api-contract.md §9). Anything but "true" means off. */
export function youtubeStudioEnabled(): boolean {
  return process.env.YOUTUBE_STUDIO_ENABLED?.trim().toLowerCase() === 'true'
}

export const STUDIO_OFF_MESSAGE = 'यूट्यूब स्टूडियो अभी बंद है।'

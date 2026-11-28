import { describe, expect, it } from 'vitest'

import { checklistComplete, cleanPostInput, istToIso, isoToIst, parseHashtags, parseTags } from '@/lib/youtube/postInput'

describe('parseTags', () => {
  it('splits on commas and new lines, trims, drops # and duplicates', () => {
    expect(parseTags('देहरादून न्यूज़, uttarakhand news\n#Dehradun ,  ,UTTARAKHAND NEWS')).toEqual(['देहरादून न्यूज़', 'uttarakhand news', 'Dehradun'])
  })
  it('non-strings → []', () => expect(parseTags(['a'])).toEqual([]))
})

describe('parseHashtags', () => {
  it('adds # and splits on spaces/commas', () => {
    expect(parseHashtags('उत्तराखंड #Dehradun, ##news #dehradun')).toEqual(['#उत्तराखंड', '#Dehradun', '#news'])
  })
  it('keeps more than 15 so the guard can report it', () => {
    expect(parseHashtags(Array.from({ length: 17 }, (_, i) => `t${i}`).join(' '))).toHaveLength(17)
  })
})

describe('India time', () => {
  it('converts both ways', () => {
    expect(istToIso('2026-12-01T18:30')).toBe('2026-12-01T13:00:00.000Z')
    expect(isoToIst('2026-12-01T13:00:00.000Z')).toBe('2026-12-01T18:30')
    expect(istToIso('')).toBeNull()
    expect(istToIso('tomorrow')).toBeUndefined()
  })
})

describe('cleanPostInput', () => {
  it('keeps only allowed fields and normalises them', () => {
    const { data, errors } = cleanPostInput({
      postType: 'short',
      footage: '12',
      thumbnail: 3,
      article: 'x',
      title: '  शीर्षक  ',
      description: 'a\r\nb',
      tags: 'a, b',
      hashtags: 'c',
      privacyStatus: 'public',
      publishAtIst: '2026-12-01T18:30',
      notifySubscribers: false,
      // not allowed:
      ...({ status: 'approved', approvedBy: 1, youtubeVideoId: 'x' } as object),
    })
    expect(errors).toEqual([])
    expect(data).toEqual({
      postType: 'short',
      footage: 12,
      article: null,
      thumbnail: 3,
      title: 'शीर्षक',
      description: 'a\nb',
      tags: ['a', 'b'],
      hashtags: ['#c'],
      privacyStatus: 'public',
      publishAt: '2026-12-01T13:00:00.000Z',
      notifySubscribers: false,
      madeForKids: false,
      containsSyntheticMedia: false,
    })
  })
  it('defaults: video, unlisted, notify on; bad schedule is an error', () => {
    const { data, errors } = cleanPostInput({ privacyStatus: 'everyone', publishAtIst: 'soon' })
    expect(data).toMatchObject({ postType: 'video', privacyStatus: 'unlisted', notifySubscribers: true })
    expect(errors).toHaveLength(1)
  })
})

describe('review checklist', () => {
  it('needs all four ticks as real booleans', () => {
    expect(checklistComplete({ rights: true, minors: true, defamation: true, accuracy: true })).toBe(true)
    expect(checklistComplete({ rights: true, minors: true, defamation: true })).toBe(false)
    expect(checklistComplete({ rights: 'true', minors: true, defamation: true, accuracy: true })).toBe(false)
    expect(checklistComplete(null)).toBe(false)
  })
})

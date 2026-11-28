import type { YtPostStatus } from '@/access/youtubeLimits'

export const STATUS_LABEL: Record<YtPostStatus, string> = {
  draft: 'ड्राफ़्ट',
  pending_review: 'समीक्षा में',
  approved: 'मंज़ूर (कतार में)',
  uploading: 'अपलोड हो रहा है',
  processing: 'यूट्यूब पर प्रोसेस',
  scheduled: 'शेड्यूल्ड',
  published: 'प्रकाशित',
  failed: 'विफल',
  cancelled: 'रद्द',
}

export const STATUS_TONE: Record<YtPostStatus, 'neutral' | 'warn' | 'ok' | 'bad' | 'info'> = {
  draft: 'neutral',
  pending_review: 'warn',
  approved: 'info',
  uploading: 'info',
  processing: 'info',
  scheduled: 'ok',
  published: 'ok',
  failed: 'bad',
  cancelled: 'neutral',
}

export const PRIVACY_LABEL: Record<string, string> = { public: 'सार्वजनिक', unlisted: 'अनलिस्टेड (केवल लिंक से)', private: 'निजी' }

export const EVENT_LABEL: Record<string, string> = {
  created: 'बनाई गई',
  submitted: 'समीक्षा के लिए भेजी गई',
  rejected: 'लौटाई गई',
  approved: 'मंज़ूर',
  upload_started: 'अपलोड शुरू',
  chunk: 'अपलोड जारी',
  uploaded: 'अपलोड पूरा',
  thumbnail_set: 'थंबनेल लगा',
  processed: 'यूट्यूब प्रोसेसिंग पूरी',
  scheduled: 'शेड्यूल हुई',
  published: 'प्रकाशित',
  failed: 'विफल',
  retried: 'फिर से कोशिश',
  cancelled: 'रद्द',
}

export const ORIENTATION_LABEL: Record<string, string> = { landscape: 'आड़ा', vertical: 'खड़ा', square: 'चौकोर' }

export const CHECKLIST_LABEL = {
  rights: 'फ़ुटेज हमारा है और दिखाए गए लोगों की सहमति है।',
  minors: 'किसी नाबालिग, पीड़ित या आरोपी की पहचान उजागर नहीं होती।',
  defamation: 'वीडियो और विवरण में कोई मानहानिकारक या अपुष्ट आरोप नहीं है।',
  accuracy: 'शीर्षक और विवरण सटीक हैं, भ्रामक नहीं।',
} as const

export function formatIst(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('hi-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

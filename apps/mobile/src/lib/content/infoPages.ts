/**
 * Text of the About us, Contact us, Privacy policy and Terms & conditions screens. Kept in the app (supplied by
 * the publisher), not loaded from the CMS or the website. Edit the text here; the screen is src/app/info/[slug].tsx.
 */
import type Ionicons from '@expo/vector-icons/Ionicons'

export type InfoLink = {
  /** Shown in front of the value, e.g. "Advertising and partnerships". */
  label?: string
  /** Text of the link, e.g. the phone number or email address. */
  value: string
  /** Opened on tap: tel:, mailto: or https: */
  href: string
  icon: keyof typeof Ionicons.glyphMap
}

export type InfoSection = {
  /** Section number shown before the title (policies). */
  number?: string
  title?: string
  subtitle?: string
  paragraphs?: string[]
  links?: InfoLink[]
}

export type InfoPage = {
  /** Title in the top bar (English, like the rest of the account area). */
  screenTitle: string
  title?: string
  meta?: string
  intro?: string[]
  sections: InfoSection[]
}

const EMAIL = 'newsloklens@gmail.com'
const PHONE = '+91 70374 55895'
const PHONE_HREF = 'tel:+917037455895'
const OFFICE = 'LokLens News, Sanga Cottage, Lower Mall Road, Almora, Uttarakhand – 263601, India'

const emailLink = (label?: string): InfoLink => ({ label, value: EMAIL, href: `mailto:${EMAIL}`, icon: 'mail-outline' })
const phoneLink: InfoLink = { value: PHONE, href: PHONE_HREF, icon: 'call-outline' }

/** Contact block at the end of the privacy policy and the terms. */
const contactLinks: InfoLink[] = [
  { label: 'Email', ...emailLink() },
  { label: 'Phone', ...phoneLink },
]
const officeLine = `Office: ${OFFICE}.`

export const INFO_PAGES = {
  about: {
    screenTitle: 'About us',
    sections: [
      {
        title: '1. हमारे बारे में (About Us)',
        subtitle: 'दुनिया को देखने का एक स्पष्ट और निष्पक्ष नज़रिया',
        paragraphs: [
          'लोकलेंस न्यूज़ (LokLens News) एक डिजिटल समाचार मंच है, जो विश्वसनीय, प्रासंगिक और सार्थक पत्रकारिता के लिए समर्पित है। हमारा मानना है कि समाचार केवल जानकारी देने का माध्यम नहीं हैं, बल्कि वे जागरूकता पैदा करते हैं, संवाद को प्रोत्साहित करते हैं और लोकतंत्र को मजबूत बनाते हैं।',
          'हमारा उद्देश्य राजनीति, शासन-व्यवस्था, जनहित के मुद्दों और सामाजिक सरोकारों से लेकर शिक्षा, प्रौद्योगिकी, संस्कृति और उभरते घटनाक्रमों तक, उन सभी विषयों को आपसे जोड़ना है जो आम जनजीवन को प्रभावित करते हैं। हम समाचारों को सटीकता, स्पष्टता और उचित संदर्भ के साथ प्रस्तुत करने का प्रयास करते हैं।',
          'हर खबर महत्वपूर्ण है, हर दृष्टिकोण निष्पक्ष विचार का हकदार है और हर नागरिक को विश्वसनीय जानकारी पाने का अधिकार है। तेजी से बदलते डिजिटल दौर में हमारा प्रयास केवल सुर्खियों तक सीमित रहना नहीं, बल्कि तथ्यों की पड़ताल करना, सवाल उठाना और घटनाओं के वास्तविक महत्व को समझाना है।',
          'हमारी पत्रकारिता संपादकीय निष्ठा, तथ्यात्मक सटीकता, जनहित और जवाबदेही के सिद्धांतों पर आधारित है। डिजिटल माध्यमों से हम समुदायों को जोड़ने, उन आवाज़ों को मंच देने का प्रयास करते हैं जिन्हें अक्सर पर्याप्त स्थान नहीं मिलता और नागरिकों की जागरूक एवं सक्रिय भागीदारी को प्रोत्साहित करते हैं।',
        ],
      },
      {
        title: '2. हमारा मिशन (Our Mission)',
        subtitle: 'जानकारी देना। सशक्त बनाना। प्रेरित करना।',
        paragraphs: [
          'हमारा मिशन विश्वसनीय, स्वतंत्र सोच पर आधारित और सभी के लिए सुलभ पत्रकारिता को जन-जन तक पहुँचाना है। हमारा उद्देश्य सटीक, प्रासंगिक और व्यापक संदर्भों के साथ प्रस्तुत समाचारों के माध्यम से जानकारी और वास्तविक समझ के बीच की दूरी को कम करना है।',
        ],
      },
      {
        title: '3. हमारा विज़न (Our Vision)',
        subtitle: 'अधिक जागरूक समाज। अधिक जवाबदेह भविष्य।',
        paragraphs: [
          'हमारा विज़न लोकलेंस न्यूज़ को एक ऐसे विश्वसनीय डिजिटल पत्रकारिता मंच के रूप में स्थापित करना है, जिसकी पहचान विश्वसनीयता, संपादकीय निष्ठा, नवाचार और सार्थक जनभागीदारी से हो।',
          'हम एक ऐसे मीडिया परिवेश की कल्पना करते हैं, जहाँ अटकलों से अधिक महत्व तथ्यों को मिले, विविध आवाज़ों को सुना जाए और पत्रकारिता लोकतांत्रिक मूल्यों एवं सामाजिक प्रगति को मजबूत बनाने में महत्वपूर्ण भूमिका निभाए।',
          'हमारा प्रयास स्थानीय वास्तविकताओं को क्षेत्रीय, राष्ट्रीय और वैश्विक दृष्टिकोण से जोड़ना है, ताकि हर महत्वपूर्ण मुद्दे और घटना को वह ध्यान मिल सके जिसकी वह हकदार है।',
          'डिजिटल नवाचार, जिम्मेदार समाचार प्रस्तुति और पाठकों की भागीदारी को अपनाते हुए हम गुणवत्तापूर्ण पत्रकारिता को भौगोलिक और सामाजिक सीमाओं से परे सभी तक पहुँचाना चाहते हैं।',
        ],
      },
    ],
  },

  contact: {
    screenTitle: 'Contact us',
    sections: [
      {
        title: '📍 कार्यालय का पता (Office)',
        paragraphs: [OFFICE],
      },
      {
        title: '📞 फ़ोन संपर्क (Phone)',
        links: [phoneLink],
      },
      {
        title: '✉️ ईमेल संपर्क (Email Inquiries)',
        links: [
          emailLink('General and editorial inquiries'),
          emailLink('News tips and press releases'),
          emailLink('Advertising and partnerships'),
          emailLink('Corrections and complaints'),
        ],
      },
      {
        title: '🌐 सोशल मीडिया (Follow Us)',
        links: [
          { value: 'YouTube', href: 'https://www.youtube.com/@loklensnews', icon: 'logo-youtube' },
          { value: 'Facebook', href: 'https://facebook.com/', icon: 'logo-facebook' },
          { value: 'Instagram', href: 'https://instagram.com/', icon: 'logo-instagram' },
          { value: 'X (Twitter)', href: 'https://x.com/', icon: 'logo-twitter' },
        ],
      },
    ],
  },

  privacy: {
    screenTitle: 'Privacy policy',
    title: 'Privacy Policy',
    meta: 'अंतिम अद्यतन (Last Updated): नवंबर 2026',
    intro: [
      'LokLens News respects the privacy of its readers and visitors. This policy describes information that may be collected through loklensnews.com, why it may be used, and how users can contact us. The details below must be checked against the website’s actual technology and practices before publication.',
    ],
    sections: [
      {
        number: '1.',
        title: 'Information Collected',
        paragraphs: [
          'Depending on available features, we may collect information voluntarily submitted through forms or email, such as names, email addresses, phone numbers, messages and news tips. Technical data may include IP addresses, device/browser information, pages visited, approximate visit duration and referring pages.',
        ],
      },
      {
        number: '2.',
        title: 'Uses of Information',
        paragraphs: [
          'Where collected, information may be used to respond to inquiries, manage corrections, operate and secure the website, understand audience engagement, improve services, deliver opted-in updates and meet legal obligations.',
        ],
      },
      {
        number: '3.',
        title: 'Cookies and Analytics',
        paragraphs: [
          'Cookies or similar technologies may support site functionality, traffic measurement and advertising. Users can manage browser settings and available consent controls. Where required by law, consent will be sought for non-essential tracking.',
        ],
      },
      {
        number: '4.',
        title: 'Third-Party Services',
        paragraphs: [
          'Hosting providers, analytics services, video platforms, social networks and advertising providers may process data under their own terms and privacy notices.',
        ],
      },
      {
        number: '5.',
        title: 'Information Sharing',
        paragraphs: [
          'Information may be shared with authorized service providers where necessary for site operations or when required by applicable law. We do not sell personal information to third parties.',
        ],
      },
      {
        number: '6.',
        title: 'Security',
        paragraphs: ['We aim to apply reasonable technical and organizational safeguards, although no internet-based system is entirely secure.'],
      },
      {
        number: '7.',
        title: 'Retention',
        paragraphs: [
          'Information is retained only as reasonably necessary for its collection purpose or to satisfy applicable legal requirements. Actual retention periods depend on the data and service.',
        ],
      },
      {
        number: '8.',
        title: 'Your Rights',
        paragraphs: [
          'Subject to applicable law, users may request access to information about processing, correction, updating, withdrawal of consent or deletion where applicable. Contact us using the details below.',
        ],
      },
      {
        number: '9.',
        title: 'Children',
        paragraphs: [
          'We do not intentionally seek children’s personal information without consent or authorization required by applicable law. Report concerns to the contact address below.',
        ],
      },
      {
        number: '10.',
        title: 'External Links',
        paragraphs: ['Third-party sites linked from LokLens News maintain their own privacy practices. Please review their policies.'],
      },
      {
        number: '11.',
        title: 'Policy Updates',
        paragraphs: ['Changes to this policy will be posted on this page with an updated effective date.'],
      },
      {
        number: '12.',
        title: 'Contact Us & Rights Inquiries',
        paragraphs: [
          'If you have questions, feedback, or wish to exercise your rights regarding personal data, please contact us using the information below:',
        ],
        links: contactLinks,
      },
      { paragraphs: [officeLine] },
    ],
  },

  terms: {
    screenTitle: 'Terms & conditions',
    title: 'Terms & Conditions',
    meta: 'अंतिम अद्यतन (Last Updated): नवंबर 2026',
    intro: [
      'Welcome to LokLens News. These terms govern access to and use of our website at loklensnews.com and its news, video and other digital content. By using the website, you agree to these terms. If you do not agree, please discontinue use.',
    ],
    sections: [
      {
        number: '1.',
        title: 'Website Use',
        paragraphs: [
          'Content is provided for general informational purposes. Users must access the website lawfully and must not disrupt its operation, compromise security or violate applicable laws.',
        ],
      },
      {
        number: '2.',
        title: 'Intellectual Property',
        paragraphs: [
          'Unless otherwise indicated, original articles, photographs, graphics, videos, logos and designs belong to LokLens News or their respective rights holders and are used with permission or other lawful basis.',
          'Sharing links is permitted; reproducing or commercially exploiting protected content requires authorization unless permitted by law.',
        ],
      },
      {
        number: '3.',
        title: 'Accuracy and Updates',
        paragraphs: [
          'We strive for accurate and timely reporting, but developing news may change. We cannot guarantee that all content remains complete, current or error-free. We may correct, update or remove content as necessary.',
        ],
      },
      {
        number: '4.',
        title: 'Editorial Independence',
        paragraphs: [
          'Editorial decisions are intended to reflect journalistic standards, factual accuracy and public interest. Attributed opinions from guests or interviewees do not necessarily represent the views of LokLens News.',
        ],
      },
      {
        number: '5.',
        title: 'User Conduct',
        paragraphs: [
          'Users must not post unlawful, threatening, defamatory or abusive material; distribute malware or spam; impersonate others; infringe rights; or attempt unauthorized system access. Where interactive features exist, we may moderate content in accordance with applicable law.',
        ],
      },
      {
        number: '6.',
        title: 'Third-Party Links',
        paragraphs: [
          'Links to external websites, social platforms and services are provided for convenience. Their content and practices are controlled by the respective third parties.',
        ],
      },
      {
        number: '7.',
        title: 'Advertising',
        paragraphs: [
          'The website may feature advertising, promotions and sponsored content. Paid or sponsored material should be appropriately identified and distinguished from editorial coverage.',
        ],
      },
      {
        number: '8.',
        title: 'Liability',
        paragraphs: [
          'To the extent permitted by applicable law, LokLens News is not liable for losses resulting from technical interruptions, third-party services or reliance on general website information. Nothing excludes liability that cannot legally be excluded.',
        ],
      },
      {
        number: '9.',
        title: 'Changes',
        paragraphs: [
          'These terms may be updated. The revised version and effective date will be posted here. Continued use following changes may constitute acceptance where legally valid.',
        ],
      },
      {
        number: '10.',
        title: 'Governing Law',
        paragraphs: ['These terms are governed by applicable Indian law. Disputes are subject to the jurisdiction of competent courts under applicable law.'],
      },
      {
        number: '11.',
        title: 'Contact',
        paragraphs: ['For questions or further information regarding these Terms & Conditions, please reach out to us:'],
        links: contactLinks,
      },
      { paragraphs: [officeLine] },
    ],
  },
} satisfies Record<string, InfoPage>

export type InfoSlug = keyof typeof INFO_PAGES

export const isInfoSlug = (slug: string | undefined): slug is InfoSlug => !!slug && slug in INFO_PAGES

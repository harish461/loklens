import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumbs } from '@/components/Navigation'

import styles from './about.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'हमारे बारे में (About Us) — लोक Lens न्यूज़',
  description:
    'लोकलेंस न्यूज़ (LokLens News) एक डिजिटल समाचार मंच है, जो विश्वसनीय, प्रासंगिक और सार्थक पत्रकारिता के लिए समर्पित है।',
}

export default function AboutPage() {
  const missionPoints = [
    {
      title: 'सटीकता और विश्वसनीयता',
      desc: 'सत्यापित तथ्यों, भरोसेमंद स्रोतों और जिम्मेदार पत्रकारिता को प्राथमिकता देना।',
    },
    {
      title: 'जनहित की पत्रकारिता',
      desc: 'समुदायों, शासन-व्यवस्था और आम जनजीवन को प्रभावित करने वाले मुद्दों को प्रमुखता से उठाना।',
    },
    {
      title: 'जवाबदेही और पारदर्शिता',
      desc: 'महत्वपूर्ण सवाल उठाना और सार्वजनिक संस्थानों में पारदर्शिता एवं जवाबदेही को प्रोत्साहित करना।',
    },
    {
      title: 'विविध दृष्टिकोण',
      desc: 'विभिन्न समुदायों, विचारों और अनुभवों को निष्पक्ष रूप से स्थान देना।',
    },
    {
      title: 'डिजिटल नवाचार',
      desc: 'समाचारों को अधिक सुलभ और प्रभावशाली बनाने के लिए वीडियो पत्रकारिता और आधुनिक डिजिटल माध्यमों का उपयोग करना।',
    },
    {
      title: 'जिम्मेदार पत्रकारिता',
      desc: 'सनसनीखेज खबरों, भ्रामक सूचनाओं और गलत नैरेटिव से बचते हुए तथ्यपरक पत्रकारिता को बढ़ावा देना।',
    },
  ]

  return (
    <div className={`container ${styles.pageWrap}`}>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: 'होम', href: '/' },
          { label: 'हमारे बारे में' },
        ]}
      />

      {/* Hero / Section 1: हमारे बारे में (About Us) */}
      <article className={styles.heroCard}>
        <span className={styles.badge}>परिचय</span>
        <h1 className={styles.mainTitle}>1. हमारे बारे में (About Us)</h1>
        <p className={styles.tagline}>दुनिया को देखने का एक स्पष्ट और निष्पक्ष नज़रिया</p>

        <div className={styles.leadText}>
          <p>
            लोकलेंस न्यूज़ (LokLens News) एक डिजिटल समाचार मंच है, जो विश्वसनीय, प्रासंगिक और सार्थक पत्रकारिता के लिए
            समर्पित है। हमारा मानना है कि समाचार केवल जानकारी देने का माध्यम नहीं हैं, बल्कि वे जागरूकता पैदा करते हैं,
            संवाद को प्रोत्साहित करते हैं और लोकतंत्र को मजबूत बनाते हैं।
          </p>
          <p>
            हमारा उद्देश्य राजनीति, शासन-व्यवस्था, जनहित के मुद्दों और सामाजिक सरोकारों से लेकर शिक्षा, प्रौद्योगिकी,
            संस्कृति और उभरते घटनाक्रमों तक, उन सभी विषयों को आपसे जोड़ना है जो आम जनजीवन को प्रभावित करते हैं। हम समाचारों
            को सटीकता, स्पष्टता और उचित संदर्भ के साथ प्रस्तुत करने का प्रयास करते हैं।
          </p>
          <p>
            हर खबर महत्वपूर्ण है, हर दृष्टिकोण निष्पक्ष विचार का हकदार है और हर नागरिक को विश्वसनीय जानकारी पाने का अधिकार
            है। तेजी से बदलते डिजिटल दौर में हमारा प्रयास केवल सुर्खियों तक सीमित रहना नहीं, बल्कि तथ्यों की पड़ताल करना, सवाल
            उठाना और घटनाओं के वास्तविक महत्व को समझाना है।
          </p>
          <p>
            हमारी पत्रकारिता संपादकीय निष्ठा, तथ्यात्मक सटीकता, जनहित और जवाबदेही के सिद्धांतों पर आधारित है। डिजिटल
            माध्यमों से हम समुदायों को जोड़ने, उन आवाज़ों को मंच देने का प्रयास करते हैं जिन्हें अक्सर पर्याप्त स्थान नहीं
            मिलता और नागरिकों की जागरूक एवं सक्रिय भागीदारी को प्रोत्साहित करते हैं।
          </p>
        </div>

        <div className={styles.quoteBox}>लोकलेंस न्यूज़ — सुर्खियों से आगे, सच्चाई के और करीब।</div>
      </article>

      {/* Section 2: हमारा मिशन (Our Mission) */}
      <section className={styles.section}>
        <div className={styles.sectionCard}>
          <header className={styles.sectionHeader}>
            <span className={styles.badge}>उद्देश्य</span>
            <h2 className={styles.sectionTitle}>2. हमारा मिशन (Our Mission)</h2>
            <p className={styles.sectionSubtitle}>जानकारी देना। सशक्त बनाना। प्रेरित करना।</p>
            <p className={styles.sectionIntro}>
              हमारा मिशन विश्वसनीय, स्वतंत्र सोच पर आधारित और सभी के लिए सुलभ पत्रकारिता को जन-जन तक पहुँचाना है। हमारा
              उद्देश्य सटीक, प्रासंगिक और व्यापक संदर्भों के साथ प्रस्तुत समाचारों के माध्यम से जानकारी और वास्तविक समझ के
              बीच की दूरी को कम करना है।
            </p>
          </header>

          <div className={styles.pillarsGrid}>
            {missionPoints.map((item, idx) => (
              <div key={item.title} className={styles.pillarCard}>
                <span className={styles.pillarNum}>{idx + 1}</span>
                <h3 className={styles.pillarTitle}>{item.title}</h3>
                <p className={styles.pillarDesc}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div className={styles.summaryCallout}>
            हमारा उद्देश्य केवल यह बताना नहीं है कि क्या हुआ, बल्कि यह समझाना भी है कि वह क्यों महत्वपूर्ण है।
          </div>
        </div>
      </section>

      {/* Section 3: हमारा विज़न (Our Vision) */}
      <section className={styles.section}>
        <div className={styles.sectionCard}>
          <header className={styles.sectionHeader}>
            <span className={styles.badge}>दूरदर्शिता</span>
            <h2 className={styles.sectionTitle}>3. हमारा विज़न (Our Vision)</h2>
            <p className={styles.sectionSubtitle}>अधिक जागरूक समाज। अधिक जवाबदेह भविष्य।</p>
          </header>

          <div className={styles.visionGrid}>
            <p>
              हमारा विज़न लोकलेंस न्यूज़ को एक ऐसे विश्वसनीय डिजिटल पत्रकारिता मंच के रूप में स्थापित करना है, जिसकी
              पहचान विश्वसनीयता, संपादकीय निष्ठा, नवाचार और सार्थक जनभागीदारी से हो।
            </p>
            <p>
              हम एक ऐसे मीडिया परिवेश की कल्पना करते हैं, जहाँ अटकलों से अधिक महत्व तथ्यों को मिले, विविध आवाज़ों को सुना
              जाए और पत्रकारिता लोकतांत्रिक मूल्यों एवं सामाजिक प्रगति को मजबूत बनाने में महत्वपूर्ण भूमिका निभाए।
            </p>
            <p>
              हमारा प्रयास स्थानीय वास्तविकताओं को क्षेत्रीय, राष्ट्रीय और वैश्विक दृष्टिकोण से जोड़ना है, ताकि हर महत्वपूर्ण
              मुद्दे और घटना को वह ध्यान मिल सके जिसकी वह हकदार है।
            </p>
            <p>
              डिजिटल नवाचार, जिम्मेदार समाचार प्रस्तुति और पाठकों की भागीदारी को अपनाते हुए हम गुणवत्तापूर्ण पत्रकारिता को
              भौगोलिक और सामाजिक सीमाओं से परे सभी तक पहुँचाना चाहते हैं।
            </p>
          </div>

          <div className={styles.visionHighlight}>
            लोकलेंस न्यूज़ केवल एक समाचार मंच बनकर नहीं रहना चाहता, बल्कि सूचना, समझ और जनसंवाद का एक विश्वसनीय केंद्र
            बनना चाहता है।
          </div>
        </div>
      </section>

      {/* Contact & Interaction CTA Banner */}
      <div className={styles.actionBanner}>
        <h3 className={styles.actionTitle}>हमसे जुड़ें और अपनी राय साझा करें</h3>
        <p className={styles.actionDesc}>
          यदि आपके पास कोई सुझाव, समाचार टिप या प्रश्न है, तो हम आपसे सुनने के लिए उत्सुक हैं।
        </p>
        <div className={styles.actionButtons}>
          <Link href="/contact" className={styles.btnPrimary}>
            संपर्क करें (Contact Us)
          </Link>
          <Link href="/e-paper" className={styles.btnSecondary}>
            ई-पेपर पढ़ें
          </Link>
        </div>
      </div>
    </div>
  )
}

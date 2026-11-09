/**
 * Hindi admin UI. Payload 3.93 ships no Hindi translation, so this pack deep-merges a Hindi override
 * of the most visible strings onto the full English pack (every missing key stays English).
 * Users pick it under Account → Language. Extend `hiOverrides` as editors request more.
 */
import { en } from '@payloadcms/translations/languages/en'

type Dict = { [key: string]: string | Dict }

const hiOverrides: Dict = {
  general: {
    save: 'सहेजें',
    createNew: 'नया बनाएं',
    delete: 'हटाएं',
    cancel: 'रद्द करें',
    filters: 'फ़िल्टर',
    dashboard: 'डैशबोर्ड',
    edit: 'संपादित करें',
    createdAt: 'बनाया गया',
    updatedAt: 'अपडेट किया गया',
    loading: 'लोड हो रहा है',
    saving: 'सहेजा जा रहा है...',
    collections: 'संग्रह',
    globals: 'सेटिंग्स',
    columns: 'कॉलम',
    or: 'या',
    and: 'और',
    yes: 'हाँ',
    no: 'नहीं',
    language: 'भाषा',
    copy: 'कॉपी',
    duplicate: 'डुप्लिकेट',
    close: 'बंद करें',
    confirm: 'पुष्टि करें',
    previous: 'पिछला',
    next: 'अगला',
    welcome: 'स्वागत है',
    success: 'सफल',
    error: 'त्रुटि',
    submit: 'जमा करें',
    sort: 'क्रम',
    nothingFound: 'कुछ नहीं मिला',
    remove: 'हटाएं',
    backToDashboard: 'डैशबोर्ड पर वापस',
    leaveAnyway: 'फिर भी छोड़ें',
    stayOnThisPage: 'इसी पेज पर रहें',
    documents: 'दस्तावेज़',
    document: 'दस्तावेज़',
    none: 'कोई नहीं',
    clear: 'साफ़ करें',
    deleting: 'हटाया जा रहा है...',
    livePreview: 'लाइव प्रीव्यू',
    changesNotSaved: 'आपके बदलाव सहेजे नहीं गए हैं। अभी छोड़ने पर बदलाव खो जाएंगे।',
  },
  authentication: {
    login: 'लॉग इन',
    logout: 'लॉग आउट',
    logOut: 'लॉग आउट',
    forgotPassword: 'पासवर्ड भूल गए',
    loggedOutSuccessfully: 'आप सफलतापूर्वक लॉग आउट हो गए हैं।',
    account: 'खाता',
    newPassword: 'नया पासवर्ड',
    confirmPassword: 'पासवर्ड की पुष्टि करें',
    changePassword: 'पासवर्ड बदलें',
    backToLogin: 'लॉग इन पर वापस',
    createFirstUser: 'पहला उपयोगकर्ता बनाएं',
    beginCreateFirstUser: 'शुरू करने के लिए पहला उपयोगकर्ता बनाएं।',
  },
  version: {
    draft: 'ड्राफ़्ट',
    published: 'प्रकाशित',
    currentDraft: 'वर्तमान ड्राफ़्ट',
    previouslyPublished: 'पहले प्रकाशित',
    publish: 'प्रकाशित करें',
    publishChanges: 'बदलाव प्रकाशित करें',
    saveDraft: 'ड्राफ़्ट सहेजें',
    status: 'स्थिति',
    unpublish: 'अप्रकाशित करें',
    unpublishing: 'अप्रकाशित किया जा रहा है...',
    versions: 'संस्करण',
    version: 'संस्करण',
    schedulePublish: 'प्रकाशन शेड्यूल करें',
    restoreThisVersion: 'यह संस्करण बहाल करें',
  },
  fields: {
    addNew: 'नया जोड़ें',
    addLink: 'लिंक जोड़ें',
    chooseFromExisting: 'मौजूदा में से चुनें',
    enterURL: 'URL दर्ज करें',
    openInNewTab: 'नए टैब में खोलें',
    textToDisplay: 'दिखाया जाने वाला टेक्स्ट',
    internalLink: 'आंतरिक लिंक',
    customURL: 'कस्टम URL',
  },
  upload: {
    dragAndDrop: 'फ़ाइल यहाँ खींचकर छोड़ें',
    selectFile: 'फ़ाइल चुनें',
  },
}

function deepMerge(base: Dict, override: Dict): Dict {
  const out: Dict = { ...base }
  for (const [k, v] of Object.entries(override)) {
    const b = base[k]
    out[k] = typeof v === 'object' && typeof b === 'object' ? deepMerge(b, v) : v
  }
  return out
}

export const hi = {
  dateFNSKey: en.dateFNSKey,
  translations: deepMerge(en.translations as unknown as Dict, hiOverrides) as unknown as typeof en.translations,
}

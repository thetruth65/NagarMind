// ─── SUPPORTED LANGUAGES — 22 Indian languages (Sarvam-supported) ────────────
// STT supported (Sarvam Saarika v2.5): en, hi, bn, ta, te, mr, gu, kn, ml, pa, or, as
// Translate supported (Sarvam): all 22 below
// sarvam = BCP-47 code used in Sarvam API calls

export const SUPPORTED_LANGUAGES = [
  { code: 'en',  name: 'English',            nativeName: 'English',      sarvam: 'en-IN',  sttSupported: true  },
  { code: 'hi',  name: 'Hindi',              nativeName: 'हिंदी',          sarvam: 'hi-IN',  sttSupported: true  },
  { code: 'bn',  name: 'Bengali',            nativeName: 'বাংলা',          sarvam: 'bn-IN',  sttSupported: true  },
  { code: 'ta',  name: 'Tamil',              nativeName: 'தமிழ்',           sarvam: 'ta-IN',  sttSupported: true  },
  { code: 'te',  name: 'Telugu',             nativeName: 'తెలుగు',          sarvam: 'te-IN',  sttSupported: true  },
  { code: 'mr',  name: 'Marathi',            nativeName: 'मराठी',           sarvam: 'mr-IN',  sttSupported: true  },
  { code: 'gu',  name: 'Gujarati',           nativeName: 'ગુજરાતી',         sarvam: 'gu-IN',  sttSupported: true  },
  { code: 'kn',  name: 'Kannada',            nativeName: 'ಕನ್ನಡ',           sarvam: 'kn-IN',  sttSupported: true  },
  { code: 'ml',  name: 'Malayalam',          nativeName: 'മലയാളം',         sarvam: 'ml-IN',  sttSupported: true  },
  { code: 'pa',  name: 'Punjabi',            nativeName: 'ਪੰਜਾਬੀ',          sarvam: 'pa-IN',  sttSupported: true  },
  { code: 'or',  name: 'Odia',               nativeName: 'ଓଡ଼ିଆ',           sarvam: 'od-IN',  sttSupported: true  },
  { code: 'as',  name: 'Assamese',           nativeName: 'অসমীয়া',         sarvam: 'as-IN',  sttSupported: true  },
  { code: 'ur',  name: 'Urdu',               nativeName: 'اردو',            sarvam: 'ur-IN',  sttSupported: false },
  { code: 'mai', name: 'Maithili',           nativeName: 'मैथिली',          sarvam: 'mai-IN', sttSupported: false },
  { code: 'kok', name: 'Konkani',            nativeName: 'कोंकणी',          sarvam: 'kok-IN', sttSupported: false },
  { code: 'ne',  name: 'Nepali',             nativeName: 'नेपाली',          sarvam: 'ne-IN',  sttSupported: false },
  { code: 'sd',  name: 'Sindhi',             nativeName: 'سنڌي',            sarvam: 'sd-IN',  sttSupported: false },
  { code: 'doi', name: 'Dogri',              nativeName: 'डोगरी',           sarvam: 'doi-IN', sttSupported: false },
  { code: 'sa',  name: 'Sanskrit',           nativeName: 'संस्कृतम्',        sarvam: 'sa-IN',  sttSupported: false },
  { code: 'mni', name: 'Manipuri (Meitei)',  nativeName: 'মৈতৈলোন্',        sarvam: 'mni-IN', sttSupported: false },
  { code: 'brx', name: 'Bodo',               nativeName: 'बड़ो',             sarvam: 'brx-IN', sttSupported: false },
  { code: 'ks',  name: 'Kashmiri',           nativeName: 'کٲشُر',           sarvam: 'ks-IN',  sttSupported: false },
]
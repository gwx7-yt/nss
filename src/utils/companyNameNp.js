const COMPANY_WORD_MAP = {
  ltd: 'एल टि डि',
  limited: 'एल टि डि',
  company: 'कम्पनी',
  co: 'को',
  power: 'पावर',
  hydro: 'हाइड्रो',
  hydropower: 'हाइड्रोपावर',
  development: 'डेभलपमेन्ट',
  bank: 'बैंक',
  finance: 'फाइनान्स',
  insurance: 'इन्स्योरेन्स',
  microfinance: 'माइक्रोफाइनान्स',
  capital: 'क्यापिटल',
  investment: 'इन्भेस्टमेन्ट',
  holdings: 'होल्डिङ्स',
  trading: 'ट्रेडिङ',
  manufacturing: 'म्यानुफ्याक्चरिङ',
  cement: 'सिमेन्ट',
  telecom: 'टेलिकम',
  electronics: 'इलेक्ट्रोनिक्स',
  hotels: 'होटल्स',
  motors: 'मोटर्स',
  energy: 'इनर्जी',
  infrastructure: 'इन्फ्रास्ट्रक्चर'
};

const COMPANY_REPLACEMENTS = [
  { regex: /\bL\.?T\.?D\.?\b/gi, value: 'एल टि डि' },
  { regex: /\bLimited\b/gi, value: 'एल टि डि' }
];

const NEPALI_COMPANY_NAME_MAP = JSON.parse(`{
  "आरम्भ चौतारी लघुवित्त वित्तीय संस्था लिमिटेड": "Aarambha Chautari Laghubitta Bittya Sanstha Limited",
  "आत्मनिर्भर लघुवित्त वित्तीय संस्था लिमिटेड": "Aatmanirbhar Laghubitta Bittitya Sanstha Limited",
  "कृषि विकास बैंक लिमिटेड": "Agricultural Development Bank Limited",
  "अंकु खोला जलविद्युत कम्पनी लिमिटेड": "Ankhu Khola Jalvidhyut Company Limited",
  "एपीआई पावर कम्पनी लिमिटेड": "API Power Company Limited",
  "अरुण केबेली पावर लिमिटेड": "Arun Kabeli Power Limited",
  "अरुण भ्याली हाइड्रोपावर डेभलपमेन्ट कम्पनी लिमिटेड": "Arun Valley Hydropower Development Co. Ltd.",
  "आशा लघुवित्त वित्तीय संस्था लिमिटेड": "Asha Laghubitta Bittiya Sanstha Limited",
  "एशियन हाइड्रोपावर लिमिटेड": "Asian Hydropower Limited",
  "एशियन लाइफ इन्स्योरेन्स कम्पनी लिमिटेड": "Asian Life Insurance Co Limited",
  "अवियन लघुवित्त वित्तीय संस्था लिमिटेड": "Aviyan laghubittya bittiya sanstha limited",
  "बलेफी हाइड्रोपावर लिमिटेड": "Balephi Hydropower Limited",
  "बन्दीपुर केबल कार एण्ड टुरिज्म लिमिटेड": "Bandipur Cable Car and Tourism Limited",
  "बाराही हाइड्रोपावर पब्लिक लिमिटेड": "Barahi Hydropower Public Limited",
  "बरुण जलविद्युत कम्पनी लिमिटेड": "Barun Hydropower Co. Ltd.",
  "बेस्ट फाइनान्स कम्पनी लिमिटेड": "Best Finance Company Limited",
  "भगवती जलविद्युत विकास कम्पनी लिमिटेड": "Bhagawati Hyropower Development Company Ltd.",
  "भुगोल इनर्जी डेभलपमेन्ट कम्पनी लिमिटेड": "Bhugol Energy Development Company Limited",
  "विकास जलविद्युत कम्पनी लिमिटेड": "Bikash Hydropower Company Ltd",
  "बिन्ध्यवासिनी जलविद्युत विकास कम्पनी लिमिटेड": "Bindhyabasini Hydropower Development Company Limited",
  "विशाल बजार कम्पनी लिमिटेड": "Bishal Bazar Company Limited",
  "बोटलर्स नेपाल (बालाजु) लिमिटेड": "Bottlers Nepal (Balaju) Limited",
  "बोटलर्स नेपाल (तराई) लिमिटेड": "Bottlers Nepal (Terai) Limited",
  "बुद्धभूमि नेपाल जलविद्युत कम्पनी लिमिटेड": "Buddha bhumi nepal hydro power company limited",
  "बुंगल हाइड्रो लिमिटेड": "Bungal Hydro Limited",
  "बुटवल पावर कम्पनी लिमिटेड": "Butwal Power Company Limited",
  "CEDB जलविद्युत विकास कम्पनी लिमिटेड": "CEDB Hydropower Development Company Limited",
  "केन्द्रीय वित्त कम्पनी लिमिटेड": "Central Finance Co. Ltd.",
  "चन्द्रागिरी हिल्स लिमिटेड": "Chandragiri Hills Limited",
  "छिमेक लघुवित्त वित्तीय संस्था लिमिटेड": "Chhimek Laghubitta Bittiya Sanstha Limited",
  "छ्याङ्दी हाइड्रोपावर लिमिटेड": "Chhyangdi Hydropower Ltd.",
  "चिलिमे जलविद्युत कम्पनी लिमिटेड": "Chilime Hydropower Company Limited",
  "चिरख्वा हाइड्रोपावर लिमिटेड": "Chirkhwa Hydropower Limited",
  "नागरिक लगानी कोष": "Citizen Investment Trust",
  "नागरिक जीवन बीमा कम्पनी लिमिटेड": "Citizen Life Insurance Company Limited",
  "सिटिजन्स बैंक इन्टरनेशनल लिमिटेड": "Citizens Bank International Limited",
  "सिटी होटल लिमिटेड": "City Hotel Limited",
  "कर्पोरेट डेभलपमेन्ट बैंक लिमिटेड": "Corporate Development Bank Limited",
  "क्रेस्ट माइक्रो लाइफ इन्स्योरेन्स लिमिटेड": "Crest Micro Life Insurance Limited",
  "CYC नेपाल लघुवित्त वित्तीय संस्था लिमिटेड": "CYC Nepal Laghubitta Bittiya Sanstha Limited",
  "दरमखोला हाइड्रो इनर्जी लिमिटेड": "Daramkhola Hydro Energy Limited",
  "डेप्रोस्क लघुवित्त वित्तीय संस्था लिमिटेड": "Deprosc Laghubitta Bittiya Sanstha Limited",
  "धौलागिरी लघुवित्त वित्तीय संस्था लिमिटेड": "Dhaulagiri laghubitta Sanstha Limited",
  "दिव्यश्वरी जलविद्युत लिमिटेड": "Dibyashwori Hydropower Ltd.",
  "डोल्टी पावर कम्पनी लिमिटेड": "Dolti Power Company Limited",
  "दोर्दी खोला जलविद्युत कम्पनी लिमिटेड": "Dordi Khola Jal Bidyut Company limited",
  "पूर्वी जलविद्युत लिमिटेड": "Eastern Hydropower Limited",
  "इमर्जिङ नेपाल लिमिटेड": "Emerging Nepal Limited",
  "एभरेष्ट बैंक लिमिटेड": "Everest Bank Limited",
  "एक्सेल डेभलपमेन्ट बैंक लिमिटेड": "Excel Development Bank Limited",
  "फर्स्ट माइक्रोफाइनान्स लघुवित्त वित्तीय संस्था लिमिटेड": "First Micro Finance Laghubitta Bittiya Sanstha Limited",
  "फरवार्ड माइक्रोफाइनान्स लघुवित्त वित्तीय संस्था लिमिटेड": "Forward Microfinance Laghubitta Bittiya Sanstha Limited",
  "गणपति लघुवित्त वित्तीय संस्था लिमिटेड": "Ganapati Laghubitta Bittiya Sanstha Limited",
  "गरिमा विकास बैंक लिमिटेड": "Garima Bikas Bank Limited",
  "घलेम्दी हाइड्रो लिमिटेड": "Ghalemdi Hydro Limited",
  "घोराही सिमेन्ट उद्योग लिमिटेड": "Ghorahi Cement Industry Limited",
  "ग्लोबल आइएमई बैंक लिमिटेड": "Global IME Bank Limited",
  "ग्लोबल आइएमई लघुवित्त वित्तीय संस्था लिमिटेड": "Global IME Laghubitta Bittiya Sanstha Limited",
  "गुडविल फाइनान्स लिमिटेड": "Goodwill Finance Limited",
  "ग्रामीण विकास लघुवित्त वित्तीय संस्था लिमिटेड": "Grameen Bikas Laghubitta Bittiya Sanstha Limited",
  "ग्रिन डेभलपमेन्ट बैंक लिमिटेड": "Green Development Bank Limited",
  "ग्रीन भेन्चर्स लिमिटेड": "Green Ventures Limited",
  "ग्रीनलाइफ हाइड्रोपावर लिमिटेड": "Greenlife Hydropower Limited",
  "गार्डियन माइक्रो लाइफ इन्स्योरेन्स लिमिटेड": "Guardian Micro Life Insurance Limited",
  "गुहेश्वरी मर्चेन्ट बैंकिङ एण्ड फाइनान्स लिमिटेड": "Guheswori Merchant Banking & Finance Ltd.",
  "गुराँस लघुवित्त वित्तीय संस्था लिमिटेड": "Gurans Laghubitta Bittiya Sanstha Limited",
  "गोर्खाज फाइनान्स लिमिटेड": "Gurkhas Finance Ltd.",
  "हाथवे इन्भेस्टमेन्ट नेपाल लिमिटेड": "Hathway Investment Nepal Limited",
  "हिमाल दोलखा जलविद्युत कम्पनी लिमिटेड": "Himal Dolakha Hydropower Com. Ltd.",
  "हिमालय उर्जा विकास कम्पनी लिमिटेड": "Himalaya Urja Bikas Company Limited",
  "हिमालयन बैंक लिमिटेड": "Himalayan Bank Limited",
  "हिमालयन डिस्टिलरी लिमिटेड": "Himalayan Distillery Limited",
  "हिमालयन एभरेष्ट इन्स्योरेन्स लिमिटेड": "Himalayan Everest Insurance Limited",
  "हिमालयन हाइड्रोपावर लिमिटेड": "Himalayan Hydropower Limited",
  "हिमालयन लघुवित्त वित्तीय संस्था लिमिटेड": "Himalayan Laghubitta Bittiya Sanstha Limited",
  "हिमालयन लाइफ इन्स्योरेन्स लिमिटेड": "Himalayan Life Insurance Limited",
  "हिमालयन पावर पार्टनर लिमिटेड": "Himalayan Power Partner Limited",
  "हिमालयन पुनर्बीमा लिमिटेड": "Himalayan Reinsurance Limited",
  "हिमस्टार उर्जा कम्पनी लिमिटेड": "Himstar Urja Company Ltd.",
  "जलविद्युत लगानी तथा विकास कम्पनी लिमिटेड": "Hydorelectricity Investment and Development Company Ltd",
  "आइएमई लाइफ इन्स्योरेन्स कम्पनी लिमिटेड": "I.M.E. Life Insurance company Limitedd",
  "आईसीएफसी फाइनान्स लिमिटेड": "ICFC Finance Limited",
  "आईजीआई प्रुडेन्सियल इन्स्योरेन्स लिमिटेड": "IGI Prudential Insurance Limited",
  "इन्फिनिटी लघुवित्त वित्तीय संस्था लिमिटेड": "Infinity Laghubitta Bittiya Sastha Limited",
  "इङ्वा हाइड्रोपावर लिमिटेड": "Ingwa Hydropower Limited",
  "जानकी फाइनान्स कम्पनी लिमिटेड": "Janaki Finance Company Limited",
  "जनउत्थान सामुदायिक लघुवित्त वित्तीय संस्था लिमिटेड": "Janautthan Samudayic Laghubitta Bittya Sanstha Limited",
  "जीवन विकास लघुवित्त वित्तीय संस्था लिमिटेड": "Jeevan Bikas Laghubitta Bittiya Sanstha Limited",
  "झापा इनर्जी लिमिटेड": "Jhapa Energy Limited",
  "जोशी जलविद्युत विकास कम्पनी लिमिटेड": "Joshi Hydropower Development Company Limited",
  "ज्योति विकास बैंक लिमिटेड": "Jyoti Bikas Bank Limited",
  "कालिका लघुवित्त वित्तीय संस्था लिमिटेड": "Kalika Laghubitta Bittiya Sanstha Limited",
  "कालिका पावर कम्पनी लिमिटेड": "Kalika Power Company Limited",
  "कालिंचोक दर्शन लिमिटेड": "Kalinchowk Darshan Limited",
  "कामना सेवा विकास बैंक लिमिटेड": "Kamana Sewa Bikas Bank Limited",
  "खानीखोला हाइड्रोपावर कम्पनी लिमिटेड": "Khanikhola Hydropower Co. Ltd.",
  "कुमारी बैंक लिमिटेड": "Kumari Bank Limited",
  "कुथेली बुखारी साना जलविद्युत लिमिटेड": "Kutheli Bukhari Small Hydropower Limited",
  "लक्ष्मी लघुवित्त वित्तीय संस्था लिमिटेड": "Laxmi Laghubitta Bittiya Sanstha Limited",
  "लक्ष्मी सनराइज बैंक लिमिटेड": "Laxmi Sunrise Bank Limited",
  "लिबर्टी इनर्जी कम्पनी लिमिटेड": "Liberty Energy Company Limited",
  "जीवन बीमा निगम (नेपाल) लिमिटेड": "Life Insurance Corporation (Nepal) Limited",
  "लुम्बिनी विकास बैंक लिमिटेड": "Lumbini Bikas Bank Limited",
  "माबिलुङ इनर्जी लिमिटेड": "Mabilung Energy Limited",
  "माछापुच्छ्रे बैंक लिमिटेड": "Machhapuchhre Bank Limited",
  "मध्य भोटेकोशी जलविद्युत कम्पनी लिमिटेड": "Madhya Bhotekoshi Jalavidyut Company Limited",
  "महालक्ष्मी विकास बैंक लिमिटेड": "Mahalaxmi Bikas Bank Limited",
  "महिला लघुवित्त वित्तीय संस्था लिमिटेड": "Mahila Laghubitta Bittiya Sanstha Limited",
  "महुली लघुवित्त वित्तीय संस्था लिमिटेड": "Mahuli Laghubitta Bittiya Sanstha Limited",
  "माईखोला हाइड्रोपower लिमिटेड": "Maikhola Hydropower Limited",
  "मैलुङ खोला जलविद्यut कम्पनी लिमिटेड": "Mailung Khola Jal Vidhyut Company Limited",
  "मकर जितुमाया सुरी हाइड्रोपower लिमिटेड": "Makar Jitumaya Suri Hydropower Limited",
  "मनकामना इन्जिनियरिङ हाइड्रोपower लिमिटेड": "Manakamana Engineering Hydropower Limited",
  "मन्दाकिनी हाइड्रोपower लिमिटेड": "Mandakini Hydropower Limited",
  "मान्डु हाइड्रोपower लिमिटेड": "Mandu Hydropower Limited",
  "मञ्जुश्री फाइनान्स लिमिटेड": "Manjushree Finance Limited",
  "मानुषी लघुवित्त वित्तीय संस्था लिमिटेड": "Manushi Laghubitta Bittiya Sanstha Limited",
  "माथिल्लो मेलम खोला जलविद्यut लिमिटेड": "Mathillo Mailun Khola Jalvidhyut Ltd.",
  "मातृभूमि लघुवित्त वित्तीय संस्था लिमिटेड": "Matribhumi Lagubitta Bittiya Sanstha Limited",
  "माया खोला जलविद्यut कम्पनी लिमिटेड": "Maya Khola Hydropower Company Limited",
  "मेन्छियाम हाइड्रोपower लिमिटेड": "Menchhiyam Hydro Power Ltd",
  "मेरो माइक्रोफाइनान्स लघुवित्त वित्तीय संस्था लिमिटेड": "Meromicrofinance Laghubitta Bittiya Sanstha Ltd.",
  "मिड सोलु हाइड्रोपower लिमिटेड": "Mid solu Hydropower Limited",
  "मितेरी विकास बैंक लिमिटेड": "Miteri Development Bank Limited",
  "मिथिला लघुवित्त वित्तीय संस्था लिमिटेड": "Mithila LaghuBitta Bittiya Sanstha Limited",
  "मोदी इनर्जी लिमिटेड": "Modi Energy Limited",
  "मोलुङ हाइड्रोपower कम्पनी लिमिटेड": "Molung Hydropower Company Limited",
  "माउन्टेन इनर्जी नेपाल लिमिटेड": "Mountain Energy Nepal Limited",
  "माउन्टेन हाइड्रो नेपाल लिमिटेड": "Mountain Hydro Nepal Limited",
  "मुक्तिनाथ विकास बैंक लिमिटेड": "Muktinath Bikas Bank Limited",
  "मुक्तिनाथ कृषि कम्पनी लिमिटेड": "Muktinath Krishi Company Limited",
  "बहुउद्देश्यीय वित्त कम्पनी लिमिटेड": "Multipurpose Finance Company Limited",
  "नबिल बैंक लिमिटेड": "Nabil Bank Limited",
  "नादेप लघुवित्त वित्तीय संस्था लिमिटेड": "Nadep Laghubittiya bittya Sanstha Limited",
  "नारायणी विकास बैंक लिमिटेड": "Narayani Bikas Bank Limited",
  "राष्ट्रिय लघुवित्त वित्तीय संस्था लिमिटेड": "National Laghubitta Bittiya Sanstha Limited",
  "राष्ट्रिय जलविद्यut कम्पनी लिमिटेड": "National Hydro Power Company Limited",
  "राष्ट्रिय जीवन बीमा कम्पनी लिमिटेड": "National Life Insurance Co. Ltd.",
  "नेको इन्स्योरेन्स लिमिटेड": "Neco Insurance Limited",
  "नेपाल बैंक लिमिटेड": "Nepal Bank Limited",
  "नेपाल दूरसञ्चार कम्पनी लिमिटेड": "Nepal Doorsanchar Company Limited",
  "नेपाल फाइनान्स लिमिटेड": "Nepal Finance Limited",
  "नेपाल हाइड्रो डेभलपर्स लिमिटेड": "Nepal Hydro Developers Limited",
  "नेपाल इन्फ्रास्ट्रक्चर बैंक लिमिटेड": "Nepal Infrastructure Bank Limited",
  "नेपाल इन्स्योरेन्स कम्पनी लिमिटेड": "Nepal Insurance Co. Ltd.",
  "नेपाल इन्भेष्टमेन्ट मेगा बैंक लिमिटेड": "Nepal Investment Mega Bank Limited",
  "नेपाल लाइफ इन्स्योरेन्स कम्पनी लिमिटेड": "Nepal Life Insurance Company Limited",
  "नेपाल माइक्रो इन्स्योरेन्स कम्पनी लिमिटेड": "Nepal Micro Insurance Company Limited",
  "नेपाल पुनर्बीमा कम्पनी लिमिटेड": "Nepal Reinsurance Company Limited",
  "नेपाल रिपब्लिक मिडिया लिमिटेड": "Nepal Republic Media Limited",
  "नेपाल एसबीआई बैंक लिमिटेड": "Nepal SBI Bank Limited",
  "नेपाल वेयरहाउसिङ कम्पनी लिमिटेड": "Nepal Warehousing Company Limited",
  "नेरुडे मिरमिरे लघुवित्त वित्तीय संस्था लिमिटेड": "Nerude Mirmire Laghubitta Bittiya Sanstha Limited",
  "नेस्डो समृद्ध लघुवित्त वित्तीय संस्था लिमिटेड": "NESDO Sambridha Laghubitta Bittiya Sanstha Limited",
  "न्गादी ग्रुप पावर लिमिटेड": "Ngadi Group Power Limited",
  "एनआईसी एशिया बैंक लिमिटेड": "NIC Asia Bank Limited",
  "एनआईसी एशिया लघुवित्त वित्तीय संस्था लिमिटेड": "NIC Asia Laghubitta Bittiya Sanstha Limited",
  "निर्धन उत्थान लघुवित्त वित्तीय संस्था लिमिटेड": "Nirdhan Utthan Laghubitta Bittiya Sanstha Limited",
  "एनएलजी इन्स्योरेन्स कम्पनी लिमिटेड": "NLG Insurance Company Limited",
  "एनएमबी लघुवित्त वित्तीय संस्था लिमिटेड": "NMB Microfinance Bittiya Sanstha Ltd.",
  "एनएमबी बैंक लिमिटेड": "NMB Bank Limited",
  "एनआरएन इन्फ्रास्ट्रक्चर एण्ड डेभलपमेन्ट लिमिटेड": "NRN Infrastructure and Development Limited",
  "न्यादी हाइड्रोपower लिमिटेड": "Nyadi Hydropower Limited",
  "ओम मेगाश्री फार्मास्युटिकल्स लिमिटेड": "Om Megashree Pharmaceuticals Limited",
  "ओरिएन्टल होटल्स लिमिटेड": "Oriental Hotels Limited",
  "पञ्चकन्या माई हाइड्रोपower लिमिटेड": "Panchakanya Mai Hydropower Limited",
  "पाँचथर पावर कम्पनी लिमिटेड": "Panchthar Power Company Limited",
  "पिपल्स हाइड्रोपower कम्पनी लिमिटेड": "Peoples Hydropower Company Limited",
  "पिपल्स पower लिमिटेड": "Peoples Power Limited",
  "पोखरा फाइनान्स लिमिटेड": "Pokhara Finance Limited",
  "प्रभु बैंक लिमिटेड": "Prabhu Bank Limited",
  "प्रभु इन्स्योरेन्स लिमिटेड": "Prabhu Insurance Limited",
  "प्रभु महालक्ष्मी लाइफ इन्स्योरेन्स लिमिटेड": "Prabhu Mahalaxmi Life Insurance Limited",
  "प्राइम कमर्सियल बैंक लिमिटेड": "Prime Commercial Bank Limited",
  "प्रोग्रेसिभ फाइनान्स लिमिटेड": "Progressive Finance Limited",
  "प्योर इनर्जी लिमिटेड": "Pure Energy Limited",
  "राधी जलविद्यut कम्पनी लिमिटेड": "Radhi Bidyut Company Ltd",
  "राप्ती हाइड्रो एण्ड जनरल कन्स्ट्रक्सन लिमिटेड": "Rapti Hydro and General Construction Limited",
  "राष्ट्रिय बीमा कम्पनी लिमिटेड": "Rastriya Beema Company Limited",
  "रसुवागढी जलविद्यut कम्पनी लिमिटेड": "Rasuwagadhi Hydropower Company Limited",
  "रवा इनर्जी डेभलपमेन्ट लिमिटेड": "Rawa Energy Development Limited",
  "रिलायबल नेपाल लाइफ इन्स्योरेन्स लिमिटेड": "Reliable Nepal Life Insurance Limited",
  "रिलायन्स फाइनान्स लिमिटेड": "Reliance Finance Limited",
  "रिडी पावर कम्पनी लिमिटेड": "Ridi Power Company Limited",
  "रिभर फल्स पower लिमिटेड": "River Falls Power Limited",
  "RSDC लघुवित्त वित्तीय संस्था लिमिटेड": "RSDC Laghubitta Bittiya Sanstha Limited",
  "रु रु जलvidhyut परियोजना लिमिटेड": "Ru Ru Jalbidhyut Pariyojana Limited",
  "सागर डिस्टिलरी लिमिटेड": "Sagar Distillery Limited",
  "सगरमाथा जलvidhyut कम्पनी लिमिटेड": "Sagarmatha Jalabidhyut Company Limited",
  "सगरमाथा लुम्बिनी इन्स्योरेन्स कम्पनी लिमिटेड": "Sagarmatha Lumbini Insurance Co. Limited",
  "सहस उर्जा लिमिटेड": "Sahas Urja Limited",
  "साल्ट ट्रेडिंग कर्पोरेशन": "Salt Trading Corporation",
  "समता घरेलु लघुवित्त वित्तीय संस्था लिमिटेड": "Samata Gharelu Laghubitta Bittiya Sanstha Limited",
  "सामलिङ पower कम्पनी लिमिटेड": "Samling Power Company Limited",
  "सम्पदा लघुवित्त वित्तीय संस्था लिमिटेड": "Sampada Laghubitta Bittiya Sanstha Limited",
  "समृद्धि फाइनान्स कम्पनी लिमिटेड": "Samriddhi Finance Company Limited",
  "सामुदायिक लघुवित्त वित्तीय संस्था लिमिटेड": "Samudayik Laghubitta Bittiya Sanstha Limited",
  "साना किसान विकास लघुवित्त वित्तीय संस्था लिमिटेड": "Sana Kisan Bikas Laghubitta Bittiya Sanstha Limited",
  "सानिमा बैंक लिमिटेड": "Sanima Bank Limited",
  "सानिमा जीआईसी इन्स्योरेन्स लिमिटेड": "Sanima GIC Insurance Limited",
  "सानिमा माई हाइड्रोपower लिमिटेड": "Sanima Mai Hydropower Limited",
  "सानिमा मिडल तमोर हाइड्रोपower लिमिटेड": "Sanima Middle Tamor Hydropower Limited",
  "सानिमा रिलायन्स लाइफ इन्स्योरेन्स लिमिटेड": "Sanima Reliance Life Insurance Limited",
  "सान्जेन जलvidhyut कम्पनी लिमिटेड": "SANJEN JALAVIDHYUT COMPANY LTD",
  "सान्वी इनर्जी लिमिटेड": "Sanvi Energy Limited",
  "सप्तकोशी विकास बैंक लिमिटेड": "Saptakoshi Development bank Ltd",
  "सर्वोत्तम सिमेन्ट लिमिटेड": "Sarbottam Cement Limited",
  "सयपत्री हाइड्रोपower लिमिटेड": "Sayapatri Hydropower Limited",
  "शाङ्ग्री ला डेभलपमेन्ट बैंक लिमिटेड": "Shangri La Development Bank Limited",
  "शिखर इन्स्योरेन्स कम्पनी लिमिटेड": "Shikhar Insurance Company Limited",
  "शाइन रेसुङ्गा डेभलपमेन्ट बैंक लिमिटेड": "Shine Resunga Development Bank Limited",
  "शिवश्री हाइड्रोपower लिमिटेड": "Shiva Shree Hydropower Limited",
  "शिवम सिमेन्ट्स लिमिटेड": "Shivam Cements Limited",
  "श्री इन्भेस्टमेन्ट फाइनान्स कम्पनी लिमिटेड": "Shree Investment Finance Co. Ltd",
  "श्रीनगर एग्रीटेक इन्डस्ट्रिज लिमिटेड": "SHREENAGAR AGRITECH INDUSTRIES LIMITED",
  "श्रीजनशील लघुवित्त वित्तीय संस्था लिमिटेड": "Shrijanshil Laghubitta Baittiya sanstha Limited",
  "शुभम पower लिमिटेड": "SHUVAM POWER LIMITED",
  "सिद्धार्थ बैंक लिमिटेड": "Siddhartha Bank Limited",
  "सिद्धार्थ प्रिमियर इन्स्योरेन्स लिमिटेड": "Siddhartha Premier Insurance Limited",
  "सिक्लेस हाइड्रोपower लिमिटेड": "Sikles Hydropower Limited",
  "सिन्धु विकास बैंक लिमिटेड": "Sindhu Bikash Bank Ltd",
  "सिंगटी हाइड्रो इनर्जी लिमिटेड": "Singati Hydro Energy Limited",
  "सोल्टी होटल लिमिटेड": "Soaltee Hotel Limited",
  "सोनापुर मिनरल्स एण्ड आयल लिमिटेड": "Sonapur Minerals and Oil Limited",
  "स्ट्यान्डर्ड चार्टर्ड बैंक नेपाल लिमिटेड": "Standard Chartered Bank Nepal Limited",
  "सन नेपाल लाइफ इन्स्योरेन्स कम्पनी लिमिटेड": "Sun Nepal Life Insurance Company Limited",
  "सुपर माडी हाइड्रोपower लिमिटेड": "Super Madi Hydropower Limited",
  "सुपरमाई हाइड्रोपower लिमिटेड": "Supermai Hydropower Limited",
  "सपोर्ट लघुवित्त वित्तिय संस्था लिमिटेड": "Support Lagubitta Bittiya Sanstha Limited",
  "सूर्यज्योति लाइफ इन्स्योरेन्स कम्पनी लिमिटेड": "SuryaJyoti Life Insurance Company Limited",
  "सूर्योदय वोमी लघुवित्त वित्तीय संस्था लिमिटेड": "Suryodaya Womi Laghubitta Bittiya Sanstha Limited",
  "स्वाबलम्बन लघुवित्त वित्तीय संस्था लिमिटेड": "Swabalamban Laghubitta Bittiya Sanstha Limited",
  "स्वभुमान लघुवित्त वित्तीय संस्था लिमिटेड": "Swabhumaan Laghubitta Bittiya Sanstha Limited",
  "स्वरोजगार लघुवित्त वित्तीय संस्था लिमिटेड": "Swarojgar Laghubitta Bittiya Sanstha Limited",
  "स्वस्तिक लघुवित्त वित्तीय संस्था लिमिटेड": "Swastik Laghubitta Bittiya Sanstha Limited",
  "स्वेट गंगा हाइड्रोपower एण्ड कन्स्ट्रक्सन लिमिटेड": "Swet Ganga Hydropower and Construction Limited",
  "एसवाई प्यानल नेपाल लिमिटेड": "SY Panel Nepal Limited",
  "सिनर्जी पower डेभलपमेन्ट लिमिटेड": "Synergy Power Development Limited",
  "तारागाउँ रिजेन्सी होटल लिमिटेड": "Taragaon Regency Hotel Limited",
  "तेह्रथुम पower कम्पनी लिमिटेड": "Terhathum Power Company Limited",
  "थ्री स्टार हाइड्रोपower लिमिटेड": "Three Star Hydropower Limited",
  "ट्रेड टावर लिमिटेड": "Trade Tower Limited",
  "त्रिशूली जलvidhyut कम्पनी लिमिटेड": "Trishuli Jal Vidhyut Company Limited",
  "युनिलिभर नेपाल लिमिटेड": "Unilever Nepal Limited",
  "युनियन हाइड्रोपower लिमिटेड": "Union Hydropower Limited",
  "युनिक नेपाल लघुवित्त वित्तीय संस्था लिमिटेड": "Unique Nepal Laghubitta Bittiya Sanstha Limited",
  "युनाइटेड अजोड इन्स्योरेन्स लिमिटेड": "United Ajod Insurance Limited",
  "युनाइटेड इदी मार्डी एण्ड आरबी हाइड्रोपower लिमिटेड": "United Idi Mardi and RB Hydropower Limited",
  "युनाइटेड मोदी हाइड्रोपower लिमिटेड": "United Modi Hydropower Limited",
  "युनिभर्सल पower कम्पनी लिमिटेड": "Universal Power Company Limited",
  "उन्नति सहकारी लघुवित्त वित्तीय संस्था लिमिटेड": "Unnati Sahakarya Laghubitta Bittiya Sanstha Limited",
  "उपकार लघुवित्त वित्तीय संस्था लिमिटेड": "Upakar Laghubitta Bittiya Sanstha Limited",
  "माथिल्लो हेवाखोला जलvidhyut कम्पनी लिमिटेड": "Upper Hewakhola Hydropower Company Limited",
  "माथिल्लो लोहोर खोला जलvidhyut कम्पनी लिमिटेड": "Upper Lohore Khola Hydropower Company Limited",
  "माथिल्लो सोलु इलेक्ट्रिक कम्पनी लिमिटेड": "Upper Solu Electric Company Limited",
  "माथिल्लो स्याङ्गे जलvidhyut लिमिटेड": "Upper Syange Hydropower Limited",
  "माथिल्लो तामाकोशी जलvidhyut लिमिटेड": "Upper Tamakoshi Hydropower Limited",
  "विजय लघुवित्त वित्तीय संस्था लिमिटेड": "Vijaya Laghubitta Bittiya Sanstha Limited",
  "भिजन लुम्बिनी उर्जा कम्पनी लिमिटेड": "Vision Lumbini Urja Company Limited",
  "वीन नेपाल लघुवित्त वित्तीय संस्था लिमिटेड": "Wean Nepal Laghubitta Bittiya Sanstha Limited"
}`);

const COMPANY_NAME_OVERRIDES = Object.entries(NEPALI_COMPANY_NAME_MAP).reduce((acc, [nepaliName, englishName]) => {
  acc[englishName] = nepaliName;
  return acc;
}, {});

const NORMALIZED_OVERRIDES = Object.entries(COMPANY_NAME_OVERRIDES).reduce((acc, [englishName, nepaliName]) => {
  const key = normalizeCompanyName(englishName);
  if (key) {
    acc[key] = nepaliName;
  }
  return acc;
}, {});

const VOWEL_MATRAS = {
  a: '',
  aa: 'ा',
  i: 'ि',
  ii: 'ी',
  ee: 'ी',
  u: 'ु',
  uu: 'ू',
  oo: 'ू',
  e: 'े',
  ai: 'ै',
  o: 'ो',
  au: 'ौ'
};

const INDEPENDENT_VOWELS = {
  a: 'अ',
  aa: 'आ',
  i: 'इ',
  ii: 'ई',
  ee: 'ई',
  u: 'उ',
  uu: 'ऊ',
  oo: 'ऊ',
  e: 'ए',
  ai: 'ऐ',
  o: 'ओ',
  au: 'औ'
};

const CONSONANTS = [
  ['ksh', 'क्ष'],
  ['chh', 'छ'],
  ['kh', 'ख'],
  ['gh', 'घ'],
  ['ch', 'च'],
  ['jh', 'झ'],
  ['th', 'थ'],
  ['dh', 'ध'],
  ['ph', 'फ'],
  ['bh', 'भ'],
  ['sh', 'श'],
  ['ng', 'ङ'],
  ['ny', 'ञ'],
  ['tr', 'त्र'],
  ['gy', 'ज्ञ'],
  ['gn', 'ज्ञ'],
  ['k', 'क'],
  ['g', 'ग'],
  ['c', 'क'],
  ['j', 'ज'],
  ['t', 'ट'],
  ['d', 'ड'],
  ['n', 'न'],
  ['p', 'प'],
  ['b', 'ब'],
  ['m', 'म'],
  ['y', 'य'],
  ['r', 'र'],
  ['l', 'ल'],
  ['v', 'व'],
  ['w', 'व'],
  ['s', 'स'],
  ['h', 'ह'],
  ['f', 'फ'],
  ['z', 'ज'],
  ['q', 'क'],
  ['x', 'क्स']
];

const VOWEL_PATTERNS = ['aa', 'ai', 'au', 'ii', 'ee', 'uu', 'oo', 'a', 'i', 'u', 'e', 'o'];

function isNepaliLanguage(language) {
  const normalized = String(language || '').trim().toLowerCase();
  return normalized === 'nepali' || normalized === 'ne' || normalized === 'np';
}

function normalizeCompanyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[\u2018\u2019'"]/g, '')
    .replace(/[().,]/g, ' ')
    .replace(/\bltd\b/g, 'limited')
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchConsonant(input) {
  const lowered = input.toLowerCase();
  for (const [pattern, nepali] of CONSONANTS) {
    if (lowered.startsWith(pattern)) {
      return { nepali, length: pattern.length };
    }
  }
  return null;
}

function matchVowel(input) {
  const lowered = input.toLowerCase();
  for (const pattern of VOWEL_PATTERNS) {
    if (lowered.startsWith(pattern)) {
      return { pattern, length: pattern.length };
    }
  }
  return null;
}

function transliterateLatinWord(word) {
  if (!word) return '';
  if (/^[A-Z]{2,5}$/.test(word)) {
    return word;
  }

  let output = '';
  let i = 0;
  while (i < word.length) {
    const slice = word.slice(i);
    const vowelMatch = matchVowel(slice);
    if (vowelMatch) {
      output += INDEPENDENT_VOWELS[vowelMatch.pattern] || slice[0];
      i += vowelMatch.length;
      continue;
    }

    const consonantMatch = matchConsonant(slice);
    if (!consonantMatch) {
      output += word[i];
      i += 1;
      continue;
    }

    output += consonantMatch.nepali;
    i += consonantMatch.length;

    const vowelAfter = matchVowel(word.slice(i));
    if (vowelAfter) {
      output += VOWEL_MATRAS[vowelAfter.pattern] ?? '';
      i += vowelAfter.length;
    }
  }
  return output;
}

function transliterateCompanyName(name) {
  if (!name) {
    return '';
  }

  const overrideKey = normalizeCompanyName(name);
  if (NORMALIZED_OVERRIDES[overrideKey]) {
    return NORMALIZED_OVERRIDES[overrideKey];
  }

  return String(name);
}

function companyNameForLang(companyName, language = 'english') {
  if (!isNepaliLanguage(language)) {
    return companyName || '';
  }
  return transliterateCompanyName(companyName);
}

window.companyNameForLang = companyNameForLang;

export const DEFAULT_CHANDA_CONFIRMATION = `🙏 శ్రీ వరసిద్ధి వినాయక భక్త బృందం - {festivalYear}🙏

శ్రీ/శ్రీమతి {name} గారికి నమస్కారం.

మీ చందా విజయవంతంగా నమోదు చేయబడింది.

🧾 receiptNo : {receiptNo}
📅 Date : {date}

మీ రసీదును వీక్షించడానికి / డౌన్లోడ్ చేసుకోవడానికి:

{receiptLink}

మీ అమూల్యమైన సహకారానికి మా కమిటీ తరఫున హృదయపూర్వక ధన్యవాదాలు.

శ్రీ వరసిద్ధి వినాయక స్వామి వారి దివ్య ఆశీస్సులు మీకు, మీ కుటుంబ సభ్యులకు ఎల్లప్పుడూ ఉండాలని మనస్ఫూర్తిగా కోరుకుంటున్నాము.

🙏 గణపతి బప్పా మోరియా 🙏`;

export const DEFAULT_CHANDA_PENDING = `🙏 శ్రీ వరసిద్ధి వినాయక భక్త బృందం - {festivalYear}🙏

శ్రీ/శ్రీమతి {name} గారికి నమస్కారం.

మీ చందాలో ఇంకా ₹{pendingAmount} పెండింగ్లో ఉంది.

మీకు వీలైన సమయంలో చెల్లించి మా వినాయక ఉత్సవాలకు సహకరించగలరు.

ధన్యవాదాలు.

🙏 గణపతి బప్పా మోరియా 🙏`;

export const DEFAULT_POOJA_CONFIRMATION = `🙏 శ్రీ వరసిద్ధి వినాయక భక్త బృందం - {festivalYear}🙏

శ్రీ/శ్రీమతి {name} గారికి నమస్కారం.

మీ పూజా బుకింగ్ విజయవంతంగా నిర్ధారించబడింది.

🛕 Name : {poojaName}
📅 Date : {date}
🕘 Time : {time}

దయచేసి పూజ ప్రారంభానికి 15 నిమిషాల ముందుగా విచ్చేయగలరు.

మీ భక్తికి హృదయపూర్వక ధన్యవాదాలు.

శ్రీ వరసిద్ధి వినాయక స్వామి వారి ఆశీస్సులు మీకు, మీ కుటుంబ సభ్యులకు ఎల్లప్పుడూ ఉండాలని కోరుకుంటున్నాము.

🙏 గణపతి బప్పా మోరియా 🙏`;

export const DEFAULT_POOJA_REMINDER = `🙏 శ్రీ వరసిద్ధి వినాయక భక్త బృందం - {festivalYear}🙏

శ్రీ/శ్రీమతి {name} గారికి నమస్కారం.

మీరు బుక్ చేసిన పూజ రేపు జరగనుంది.

🛕 Name : {poojaName}
📅 Date : {date}
🕘 Time : {time}

దయచేసి పూజ ప్రారంభానికి 15 నిమిషాల ముందుగా విచ్చేసి సహకరించగలరు.

మీ రాక కోసం ఎదురుచూస్తున్నాము.

🙏 గణపతి బప్పా మోరియా 🙏`;

export const DEFAULT_FESTIVAL_GREETING = `🙏 శ్రీ వరసిద్ధి వినాయక భక్త బృందం 🙏

మీకు మరియు మీ కుటుంబ సభ్యులకు శ్రీ వినాయక చవితి శుభాకాంక్షలు.

శ్రీ వరసిద్ధి వినాయక స్వామి వారి దివ్య ఆశీస్సులు మీ కుటుంబంపై ఎల్లప్పుడూ ఉండాలని మనస్ఫూర్తిగా కోరుకుంటున్నాము.

🙏 గణపతి బప్పా మోరియా 🙏`;

/**
 * Replaces {placeholder} in the template with corresponding values from the payload.
 * 
 * @param template The template string containing {placeholders}
 * @param payload A record of key-value pairs where key is the placeholder name
 * @returns The populated string
 */
export const hydrateTemplate = (template: string, payload: Record<string, string | number>): string => {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return payload[key] !== undefined ? String(payload[key]) : match;
  });
};

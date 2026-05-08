const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

/**
 * ──────────────── SMS TEMPLATES (TELUGU) ────────────────
 */

const getTemplates = (data) => ({
  paymentReceived: `శ్రీ వరసిద్ధి వినాయక భక్త బృందం - ${data.year}

పేరు: ${data.name}
చెల్లించిన మొత్తం: ₹${data.paid}
రసీదు నం: ${data.receipt}

ధన్యవాదాలు 🙏`,

  paymentPending: `శ్రీ వరసిద్ధి వినాయక భక్త బృందం - ${data.year}

పేరు: ${data.name}
మిగిలిన మొత్తం: ₹${data.pending}

దయచేసి చెల్లించండి.

ధన్యవాదాలు 🙏`,

  acknowledgement: `శ్రీ వరసిద్ధి వినాయక భక్త బృందం - ${data.year}

పేరు: ${data.name}
మొత్తం: ₹${data.total}

మీ వివరాలు నమోదు చేయబడ్డాయి.
చెల్లింపు పెండింగ్లో ఉంది.

ధన్యవాదాలు 🙏`
});

/**
 * ──────────────── SMS API SENDER (FAST2SMS) ────────────────
 */

async function sendSms(phone, message) {
  // Retrieve API Key securely from Firebase config/environment
  // Set this using: firebase functions:config:set fast2sms.key="YOUR_KEY"
  const apiKey = functions.config().fast2sms?.key || process.env.FAST2SMS_KEY || 'YOUR_FAST2SMS_KEY_HERE';
  
  if (apiKey === 'YOUR_FAST2SMS_KEY_HERE') {
    console.error('FAST2SMS API Key not configured. SMS not sent.');
    return false;
  }

  // Clean phone number (remove +91 or other prefixes)
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  try {
    const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
      message: message,
      language: 'unicode', // Required for Telugu
      route: 'q',
      numbers: cleanPhone,
    }, {
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.return) {
      console.log(`SMS successfully sent to ${cleanPhone}`);
      return true;
    } else {
      console.error(`SMS Failed: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.error(`Fast2SMS Error: ${error.message}`);
    return false;
  }
}

/**
 * ──────────────── FIRESTORE TRIGGER: DEVOTEE MONITOR ────────────────
 */

exports.onDevoteeWrite = functions.firestore
  .document('devotees/{devoteeId}')
  .onWrite(async (change, context) => {
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!afterData) return null; // Deleted record

    const templates = getTemplates({
      year: afterData.year,
      name: afterData.name,
      paid: afterData.paidAmount,
      total: afterData.totalAmount,
      pending: afterData.pendingAmount,
      receipt: afterData.receiptNo
    });

    // ──────────────── TRIGGER 1: NEW ENTRY CREATION ────────────────
    if (!beforeData) {
      if (afterData.paidAmount === 0) {
        // Send Acknowledgement only
        return sendSms(afterData.phone, templates.acknowledgement);
      } else {
        // New entry with partial or full payment
        await sendSms(afterData.phone, templates.paymentReceived);
        if (afterData.pendingAmount > 0) {
          return sendSms(afterData.phone, templates.paymentPending);
        }
      }
    }

    // ──────────────── TRIGGER 2: PAYMENT UPDATE ────────────────
    if (beforeData && afterData.paidAmount > beforeData.paidAmount) {
      await sendSms(afterData.phone, templates.paymentReceived);
      // If still pending, send another reminder
      if (afterData.pendingAmount > 0) {
        return sendSms(afterData.phone, templates.paymentPending);
      }
    }

    // ──────────────── TRIGGER 3: MANUAL REMINDER ────────────────
    // Detects when the frontend updates 'triggerReminder' field
    if (beforeData && afterData.triggerReminder && afterData.triggerReminder !== beforeData.triggerReminder) {
      if (afterData.pendingAmount > 0) {
        return sendSms(afterData.phone, templates.paymentPending);
      }
    }

    return null;
  });

/**
 * ──────────────── WHATSAPP API SENDER (META BUSSINESS API) ────────────────
 */

exports.sendWhatsApp = functions.https.onCall(async (data, context) => {
  // 1. SECURITY: Check Authentication to prevent unauthorized API calls
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { phone, pdfUrl } = data;

  // 2. VALIDATION
  if (!phone || !pdfUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'Phone and PDF URL are required.');
  }

  // Clean phone number (get last 10 digits)
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  // 3. SECURE KEYS: Get from Firebase Config or Environment Variables
  const AISENSY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDIxYzNlMWU1NmZhMGRmMWY3NWM2MSIsIm5hbWUiOiJTVlNCQiIsImFwcE5hbWUiOiJBaVNlbnN5IiwiY2xpZW50SWQiOiI2OWQyMWMzZTFlNTZmYTBkZjFmNzVjNWMiLCJhY3RpdmVQbGFuIjoiRlJFRV9GT1JFVkVSIiwiaWF0IjoxNzc1NjcwMTk3fQ.1NcXyQZeceq65ILMv6-ZVuG5pbcVOqn_189Bu1WehIs';


  if (!AISENSY_KEY) {
    console.error('AiSensy API Key not configured.');
    throw new functions.https.HttpsError('internal', 'API key missing');
  }

  try {
    // 4. AISENSY API REQUEST POST https://backend.aisensy.com/campaign/t1/api/v2
    const payload = {
      apiKey: AISENSY_KEY,
      campaignName: "namesthe",
      destination: "91" + cleanPhone,
      media: {
        url: pdfUrl,
        filename: "receipt.pdf"
      }
    };

    const response = await axios.post(
      'https://backend.aisensy.com/campaign/t1/api/v2',
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`AiSensy WhatsApp sent to 91${cleanPhone}: ${JSON.stringify(response.data)}`);
    
    if (response.data.success === false) {
       console.error("AiSensy API reported failure", response.data);
       throw new functions.https.HttpsError('internal', response.data.message || 'Failed to send');
    }

    return { 
      success: true, 
      data: response.data 
    };

  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('AiSensy API Error:', JSON.stringify(errorData));
    throw new functions.https.HttpsError('internal', errorData?.error?.message || error.message || 'Failed to send AiSensy message');
  }
});

/**
 * ──────────────── SCHEDULED: POOJA REMINDERS ────────────────
 * Runs every 30 minutes to check if any families need pooja reminders.
 */

exports.sendScheduledPoojaReminders = functions.pubsub.schedule('every 30 minutes').onRun(async (context) => {
  const now = new Date();
  const settingsSnap = await admin.firestore().doc('settings/app').get();
  const festivalStartDateStr = settingsSnap.exists() ? settingsSnap.data().festivalStartDate : null;

  if (!festivalStartDateStr) {
    console.log("Festival start date not configured. Skipping reminders.");
    return null;
  }

  const festivalStart = new Date(festivalStartDateStr);
  const slotsSnap = await admin.firestore().collection('pooja_slots').get();

  const reminderPromises = [];

  for (const doc of slotsSnap.docs) {
    const slot = doc.data();
    const families = slot.families || [];
    const activeFamilies = families.filter(f => f.status === 'active');

    if (activeFamilies.length === 0) continue;

    // Calculate slot target date and time
    const slotDate = new Date(festivalStart);
    slotDate.setDate(slotDate.getDate() + (slot.day - 1));
    
    // Set time: Morning 8 AM, Evening 6 PM (18:00)
    const slotDateTime = new Date(slotDate);
    slotDateTime.setHours(slot.time === 'morning' ? 8 : 18, 0, 0, 0);

    const diffMs = slotDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    activeFamilies.forEach(family => {
      let message = null;
      let reminderType = null;

      // 1. One Day Before (23-25 hours before)
      if (diffHours > 23 && diffHours <= 24.5 && !family.reminded_1day) {
        message = `*Pooja Reminder (Tomorrow)*\n\n🙏 Namaste ${family.name} garu,\n\nYour Pooja slot is scheduled for tomorrow!\n📅 *Date:* ${slotDate.toDateString()}\n⏰ *Time:* ${slot.time === 'morning' ? '08:00 AM' : '06:00 PM'}\n\n_See you there!_`;
        reminderType = 'reminded_1day';
      }
      // 2. Morning Of (7-9 AM for morning, or just same day)
      // Actually user said "Morning of" and "1 hour before"
      // If morning slot, morning of and 1 hour before are same-ish.
      else if (diffHours > 2 && diffHours <= 4 && !family.reminded_morning) {
         message = `*Pooja Reminder (Today)*\n\n🙏 Namaste ${family.name} garu,\n\nYour Pooja is TODAY!\n⏰ *Time:* ${slot.time === 'morning' ? '08:00 AM' : '06:00 PM'}\n\n_Please arrive 15 mins early._`;
         reminderType = 'reminded_morning';
      }
      // 3. One Hour Before (0.5 - 1.5 hours before)
      else if (diffHours > 0.5 && diffHours <= 1.5 && !family.reminded_1hour) {
         message = `*Urgent: Pooja in 1 Hour!*\n\n🙏 Namaste ${family.name} garu,\n\nYour Pooja starts in 1 hour!\n📍 *Location:* Temple Mandapam\n\n_Om Ganeshaya Namaha!_`;
         reminderType = 'reminded_1hour';
      }

      if (message && reminderType) {
        console.log(`Sending ${reminderType} to ${family.phone}`);
        // We'll use the AiSensy Logic here if configured, or just log for now
        // In a real setup, we would call an internal function or AiSensy API directly
        reminderPromises.push(
          updateFamilyReminderStatus(doc.id, family.id, reminderType)
        );
      }
    });
  }

  return Promise.all(reminderPromises);
});

async function updateFamilyReminderStatus(slotId, familyId, reminderType) {
  const slotRef = admin.firestore().collection('pooja_slots').doc(slotId);
  return admin.firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(slotRef);
    if (!doc.exists()) return;
    const families = doc.data().families.map(f => 
      f.id === familyId ? { ...f, [reminderType]: true } : f
    );
    transaction.update(slotRef, { families });
  });
}

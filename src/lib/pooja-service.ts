import { 
  collection, 
  doc, 
  onSnapshot, 
  runTransaction, 
  serverTimestamp, 
  getDocs, 
  query, 
  where,
  setDoc,
  deleteField,
  updateDoc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { PoojaSlot, PoojaBookingData, PoojaFamilyBooking } from '../types/pooja';

const COLLECTION_NAME = 'pooja_slots';

// Listen for real-time updates
export const subscribeToSlots = (callback: (slots: PoojaSlot[]) => void) => {
  const q = collection(db, COLLECTION_NAME);
  return onSnapshot(q, (snapshot) => {
    const slots = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PoojaSlot[];
    // Sort slots by day and then by time (morning first)
    slots.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.time === 'morning' ? -1 : 1;
    });
    callback(slots);
  });
};

// Book a pooja slot for a family
export const bookPoojaSlot = async (slotId: string, bookingData: PoojaBookingData) => {
  const slotRef = doc(db, COLLECTION_NAME, slotId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const slotDoc = await transaction.get(slotRef);
      
      if (!slotDoc.exists()) {
        throw new Error("Slot does not exist!");
      }
      
      const slot = slotDoc.data() as PoojaSlot;
      const families = slot.families || [];
      
      const newFamily: PoojaFamilyBooking = {
        id: Math.random().toString(36).substr(2, 9),
        name: bookingData.name,
        phone: bookingData.phone,
        status: 'active',
        booked_at: Timestamp.now()
      };
      
      transaction.update(slotRef, {
        families: [...families, newFamily],
        status: 'booked'
      });
    });
    return { success: true };
  } catch (error: any) {
    console.error("Booking error:", error);
    return { success: false, error: error.message };
  }
};

// Cancel a specific family booking
export const cancelFamilyBooking = async (slotId: string, familyId: string) => {
  const slotRef = doc(db, COLLECTION_NAME, slotId);
  try {
    await runTransaction(db, async (transaction) => {
      const slotDoc = await transaction.get(slotRef);
      if (!slotDoc.exists()) throw new Error("Slot not found");
      
      const slot = slotDoc.data() as PoojaSlot;
      const updatedFamilies = slot.families.map(f => 
        f.id === familyId ? { ...f, status: 'cancelled' as const } : f
      );
      
      const hasActive = updatedFamilies.some(f => f.status === 'active');
      
      transaction.update(slotRef, {
        families: updatedFamilies,
        status: hasActive ? 'booked' : 'available'
      });
    });
    return { success: true };
  } catch (error: any) {
    console.error("Cancel booking error:", error);
    return { success: false, error: error.message };
  }
};

// Admin: Initialize 9 Days of Slots with Dates from settings
export const initializePoojaSlots = async (force = false) => {
  const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
  const festivalStartDate = settingsSnap.exists() ? settingsSnap.data().festivalStartDate : null;
  
  if (!festivalStartDate) {
    throw new Error("Festival start date not configured in System Settings!");
  }

  const q = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(q);
  
  // Cleanup Day 10, 11 etc if they exist
  const deleteBatch = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.day > 9) {
      deleteBatch.push(updateDoc(doc.ref, { day: deleteField() })); // Or just delete the doc
    }
  });

  if (!snapshot.empty && !force) {
    console.log("Pooja slots already initialized.");
    return;
  }

  console.log("Initializing 9 pooja days...");
  const batch = [];
  
  for (let day = 1; day <= 9; day++) {
    const times: ('morning' | 'evening')[] = ['morning', 'evening'];
    for (const time of times) {
      const id = `day${day}_${time}`;
      const slotRef = doc(db, COLLECTION_NAME, id);
      batch.push(setDoc(slotRef, {
        day,
        time,
        families: [],
        status: 'available'
      }, { merge: true }));
    }
  }
  
  await Promise.all(batch);
  console.log("Slots initialized successfully for 9 days.");
};

export const updateFestivalStartDate = async (date: string) => {
  const settingsRef = doc(db, 'settings', 'app');
  await setDoc(settingsRef, { festivalStartDate: date }, { merge: true });
};

export const getFestivalStartDate = async () => {
  const snap = await getDoc(doc(doc(db, 'settings', 'app')));
  return snap.exists() ? snap.data().festivalStartDate : null;
};

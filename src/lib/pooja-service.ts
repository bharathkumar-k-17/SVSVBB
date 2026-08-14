import { supabase } from './supabase';
import {
  PoojaSlot,
  PoojaBookingData,
  PoojaFamilyBooking
} from '../types/pooja';

const SLOTS_TABLE = 'pooja_slots';
const BOOKINGS_TABLE = 'pooja_bookings';

// Listen for real-time slot updates
export const subscribeToSlots = (
  year: number,
  callback: (slots: PoojaSlot[]) => void
) => {
  const loadSlots = async () => {
    const { data: slots, error: slotError } = await supabase
      .from(SLOTS_TABLE)
      .select('*')
      .order('day')
      .order('time');

    if (slotError) {
      console.error('Error loading slots:', slotError);
      return;
    }

    const { data: bookings, error: bookingError } = await supabase
      .from(BOOKINGS_TABLE)
      .select('*')
      .eq('year', year);

    if (bookingError) {
      console.error('Pooja bookings load error:', bookingError);
      return;
    }

    const result = (slots || []).map(slot => ({
      ...slot,
      families: (bookings || []).filter(
        booking => booking.slot_id === slot.id
      ) as PoojaFamilyBooking[]
    })) as PoojaSlot[];

    result.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.time === 'morning' ? -1 : 1;
    });

    callback(result);
  };

  loadSlots();

  const channel = supabase
    .channel('pooja-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: SLOTS_TABLE
      },
      loadSlots
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: BOOKINGS_TABLE
      },
      loadSlots
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Book pooja slot
export const bookPoojaSlot = async (
  slotId: string,
  bookingData: PoojaBookingData,
  year: number
) => {
  try {
    if (bookingData.receipt_no) {
      // Prevent duplicate bookings by checking if the receipt number is already inside the name of an active booking
      const { data: existingBookings, error: checkError } = await supabase
        .from(BOOKINGS_TABLE)
        .select('id')
        .eq('status', 'active')
        .eq('year', year)
        .like('name', `%(${bookingData.receipt_no})%`);

      if (checkError) {
        console.error('Error checking duplicate booking:', checkError);
        return { success: false, error: "Failed to verify existing bookings." };
      }

      if (existingBookings && existingBookings.length > 0) {
        return { success: false, error: "This receipt has already been used for a Pooja booking." };
      }
    }

    const bookingId =
      crypto.randomUUID?.() ||
      Math.random().toString(36).substring(2, 11);

    const { data, error: bookingError } = await supabase
      .from(BOOKINGS_TABLE)
      .insert({
        id: bookingId,
        slot_id: slotId,
        name: bookingData.receipt_no ? `${bookingData.name} (${bookingData.receipt_no})` : bookingData.name,
        phone: bookingData.phone,
        status: 'active',
        year: year
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Pooja booking save error:', bookingError);
      throw bookingError;
    }

    const { error: slotError } = await supabase
      .from(SLOTS_TABLE)
      .update({ status: 'booked' })
      .eq('id', slotId);

    if (slotError) {
      console.error('Pooja slot update error:', slotError);
      throw slotError;
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Pooja booking save error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Cancel family booking
export const cancelFamilyBooking = async (
  slotId: string,
  familyId: string
) => {
  try {
    const { error } = await supabase
      .from(BOOKINGS_TABLE)
      .update({ status: 'cancelled' })
      .eq('id', familyId)
      .eq('slot_id', slotId);

    if (error) throw error;

    const { data: activeBookings, error: activeError } =
      await supabase
        .from(BOOKINGS_TABLE)
        .select('id')
        .eq('slot_id', slotId)
        .eq('status', 'active');

    if (activeError) throw activeError;

    const { error: slotError } = await supabase
      .from(SLOTS_TABLE)
      .update({
        status:
          activeBookings && activeBookings.length > 0
            ? 'booked'
            : 'available'
      })
      .eq('id', slotId);

    if (slotError) throw slotError;

    return { success: true };
  } catch (error: any) {
    console.error('Cancel booking error:', error);

    return {
      success: false,
      error: error.message
    };
  }
};

// Initialize 8 days × morning/evening
export const initializePoojaSlots = async (force = false) => {
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('festival_start_date')
    .eq('id', 'app')
    .single();

  if (settingsError) throw settingsError;

  const festivalStartDate = settings?.festival_start_date;

  if (!festivalStartDate) {
    throw new Error(
      'Festival start date not configured in System Settings!'
    );
  }

  const { data: existingSlots, error: slotError } = await supabase
    .from(SLOTS_TABLE)
    .select('id');

  if (slotError) throw slotError;

  if (existingSlots && existingSlots.length > 0 && !force) {
    console.log('Pooja slots already initialized.');
    return;
  }

  const slots = [];

  for (let day = 1; day <= 8; day++) {
    for (const time of ['morning', 'evening'] as const) {
      slots.push({
        id: `day${day}_${time}`,
        day,
        time,
        status: 'available'
      });
    }
  }

  const { error } = await supabase
    .from(SLOTS_TABLE)
    .upsert(slots);

  if (error) throw error;

  console.log('Slots initialized successfully for 8 days.');
};

export const updateFestivalStartDate = async (date: string) => {
  const { error } = await supabase
    .from('app_settings')
    .update({
      festival_start_date: date
    })
    .eq('id', 'app');

  if (error) throw error;
};

export const getFestivalStartDate = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('festival_start_date')
    .eq('id', 'app')
    .single();

  if (error) throw error;

  return data?.festival_start_date ?? null;
};
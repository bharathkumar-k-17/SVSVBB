import { Timestamp } from 'firebase/firestore';

export type PoojaSlotStatus = 'available' | 'booked';
export type PoojaTime = 'morning' | 'evening';

export interface PoojaFamilyBooking {
  id: string; // unique id for each family booking
  name: string;
  phone: string;
  status: 'active' | 'cancelled';
  booked_at: Timestamp;
}

export interface PoojaSlot {
  id: string; // e.g., 'day1_morning'
  day: number; // 1-9
  time: PoojaTime;
  families: PoojaFamilyBooking[];
  status: PoojaSlotStatus;
}

export interface PoojaBookingData {
  name: string;
  phone: string;
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

// Settings Queries
export const useAppSettings = () => {
  return useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('id, system_access, upi_id, festival_start_date, logo_url, chanda_confirmation_template, chanda_pending_template, pooja_confirmation_template, pooja_reminder_template, festival_greeting_template')
        .eq('id', 'app')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useFestivalSettings = (year: number) => {
  return useQuery({
    queryKey: ['festivalSettings', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_settings')
        .select('id, appName, festivalYear, upiId, logoUrl, system_access')
        .eq('festivalYear', year)
        .maybeSingle();
      // If no row exists, we might need to handle it or return null, but for now just return data
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: !!year,
    refetchOnWindowFocus: false,
  });
};

export const usePortalSettings = () => {
  return useQuery({
    queryKey: ['portalSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_portal_settings')
        .select('id, portal_name, committee_name, festival_year, temple_image_url, banner_image_url, welcome_message, footer_quote, address, google_maps_url, phone_number, whatsapp_number, email, facebook_url, instagram_url, youtube_url, website_url, enable_chanda, enable_receipt, enable_pooja, enable_feedback, updated_at')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Aggregated queries for Dashboard
export const useDashboardStats = (year: number) => {
  const { appUser } = useAuthStore();
  const isVolunteer = appUser?.role === 'volunteer';
  const volunteerId = appUser?.email;

  return useQuery({
    queryKey: ['dashboardStats', year, isVolunteer, volunteerId],
    queryFn: async () => {
      // For Superadmin/Admin, fetch total collected, pending, expenses.
      // Instead of relying on client-side reduce, we do a quick select of only the amounts.
      
      const [
        { data: devoteesData, error: devError },
        { data: expensesData, error: expError },
        { count: vipCount, error: vipError }
      ] = await Promise.all([
        supabase.from('devotees').select('paid_amount, pending_amount, created_at, volunteer_id').eq('year', year),
        supabase.from('expenses').select('amount').eq('year', year),
        supabase.from('vip_gotrams').select('*', { count: 'exact', head: true }).eq('year', year)
      ]);
      
      if (devError) throw devError;
      if (expError) throw expError;
      if (vipError) throw vipError;

      const devs = devoteesData || [];
      const exps = expensesData || [];

      let totalCollected = 0;
      let totalPending = 0;
      let myTodayCollection = 0;
      let todayCollection = 0;
      let myDevoteesCount = 0;

      const today = new Date().toDateString();

      for (const d of devs) {
        const dPaid = d.paid_amount || 0;
        const dPending = d.pending_amount || 0;
        const createdAtStr = new Date(d.created_at).toDateString();
        const isMine = d.volunteer_id === volunteerId;

        totalCollected += dPaid;
        totalPending += dPending;

        if (createdAtStr === today) {
          todayCollection += dPaid;
          if (isMine) {
            myTodayCollection += dPaid;
          }
        }
        if (isMine) {
          myDevoteesCount++;
        }
      }

      const totalExpenses = exps.reduce((sum, e) => sum + (e.amount || 0), 0);

      return {
        totalCollected,
        totalPending,
        todayCollection,
        totalExpenses,
        vipCount: vipCount || 0,
        devoteesCount: devs.length,
        myTodayCollection,
        myDevoteesCount,
        expensesCount: exps.length,
      };
    },
    enabled: !!year,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Paginated Queries for Lists
export const useDevotees = (
  year: number,
  page: number,
  pageSize: number,
  search: string,
  filter: string,
  sortBy: 'LATEST' | 'AMOUNT_DESC'
) => {
  return useQuery({
    queryKey: ['devotees', year, page, pageSize, search, filter, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('devotees')
        .select('id, name, phone, receipt_no, payment_mode, total_amount, paid_amount, pending_amount, payment_status, created_at, volunteer_id, volunteer_name, gotram', { count: 'exact' })
        .eq('year', year);

      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,receipt_no.ilike.%${search}%`);
      }

      if (filter === 'VIP') {
        query = query.gte('total_amount', 1000);
      } else if (filter !== 'ALL') {
        query = query.eq('payment_status', filter);
      }

      if (sortBy === 'LATEST') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'AMOUNT_DESC') {
        query = query.order('total_amount', { ascending: false });
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      
      // Map to camelCase
      const mapped = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        receiptNo: row.receipt_no,
        paymentMode: row.payment_mode,
        totalAmount: row.total_amount,
        paidAmount: row.paid_amount,
        pendingAmount: row.pending_amount,
        paymentStatus: row.payment_status,
        createdAt: row.created_at,
        volunteerId: row.volunteer_id,
        volunteerName: row.volunteer_name,
        gotram: row.gotram,
      }));

      return {
        data: mapped,
        count: count || 0,
      };
    },
    enabled: !!year,
    staleTime: 60 * 1000, // 1 min stale time for list data
    refetchOnWindowFocus: false,
  });
};

export const useExpenses = (
  year: number,
  page: number,
  pageSize: number,
  isVolunteer: boolean,
  volunteerId?: string
) => {
  return useQuery({
    queryKey: ['expenses', year, page, pageSize, isVolunteer, volunteerId],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('id, description, amount, category, date, volunteer_id, volunteer_name', { count: 'exact' })
        .eq('year', year)
        .order('date', { ascending: false });

      if (isVolunteer && volunteerId) {
        query = query.eq('volunteer_id', volunteerId);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      // Get total amount for all matching records without pagination for the header
      let totalQuery = supabase
        .from('expenses')
        .select('amount')
        .eq('year', year);
      
      if (isVolunteer && volunteerId) {
        totalQuery = totalQuery.eq('volunteer_id', volunteerId);
      }

      const [
        { data, count, error },
        { data: totalData, error: totalError }
      ] = await Promise.all([
        query,
        totalQuery
      ]);

      if (error) throw error;
      if (totalError) throw totalError;
      
      const totalExpenses = (totalData || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);

      const mapped = (data || []).map(row => ({
        id: row.id,
        description: row.description,
        amount: row.amount,
        category: row.category,
        date: row.date,
        volunteerId: row.volunteer_id,
        volunteerName: row.volunteer_name,
      }));

      return {
        data: mapped,
        count: count || 0,
        totalExpenses
      };
    },
    enabled: !!year,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const usePayments = (
  year: number,
  page: number,
  pageSize: number,
  search: string,
  mode: 'Cash' | 'UPI'
) => {
  return useQuery({
    queryKey: ['payments', year, page, pageSize, search, mode],
    queryFn: async () => {
      let query = supabase
        .from('devotees')
        .select('id, name, phone, receipt_no, payment_mode, total_amount, paid_amount, pending_amount, payment_status, created_at, volunteer_id, volunteer_name, gotram', { count: 'exact' })
        .eq('year', year)
        .eq('payment_mode', mode)
        .gt('paid_amount', 0)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,receipt_no.ilike.%${search}%`);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        receiptNo: row.receipt_no,
        paymentMode: row.payment_mode,
        totalAmount: row.total_amount,
        paidAmount: row.paid_amount,
        pendingAmount: row.pending_amount,
        paymentStatus: row.payment_status,
        createdAt: row.created_at,
        volunteerId: row.volunteer_id,
        volunteerName: row.volunteer_name,
        gotram: row.gotram,
      }));

      return {
        data: mapped,
        count: count || 0,
      };
    },
    enabled: !!year,
    staleTime: 60 * 1000, // 1 min stale time for list data
    refetchOnWindowFocus: false,
  });
};

export const useVIPGotrams = (year: number) => {
  return useQuery({
    queryKey: ['vipGotrams', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vip_gotrams')
        .select('id, gotram, family_members, order, source, devotee_id, year, created_at')
        .eq('year', year)
        .order('order', { ascending: true });
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        gotram: row.gotram,
        familyMembers: row.family_members,
        order: row.order,
        source: row.source,
        devoteeId: row.devotee_id,
        year: row.year,
        createdAt: row.created_at,
      }));
    },
    enabled: !!year,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useCulturalEvents = (year: number) => {
  return useQuery({
    queryKey: ['culturalEvents', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cultural_events')
        .select('id, game_name, category, winner1, winner2, year, added_by, added_by_name, created_at, updated_at')
        .eq('year', year);
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        gameName: row.game_name,
        category: row.category,
        winner1: row.winner1,
        winner2: row.winner2,
        year: row.year,
        addedBy: row.added_by,
        addedByName: row.added_by_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
    enabled: !!year,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useSPLRecords = () => {
  return useQuery({
    queryKey: ['splRecords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spl_records')
        .select('id, description, amount, date')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        description: row.description,
        amount: row.amount,
        date: row.date,
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useVolunteerStats = (year: number) => {
  return useQuery({
    queryKey: ['volunteerStats', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devotees')
        .select('volunteer_id, volunteer_name, paid_amount, pending_amount, created_at')
        .eq('year', year);
      
      if (error) throw error;
      
      const today = new Date().toDateString();
      const stats = (data || []).reduce((acc: any, d: any) => {
        const vId = d.volunteer_id || 'admin';
        if (!acc[vId]) {
          acc[vId] = {
            name: d.volunteer_name || 'Admin',
            todayCount: 0,
            todayCollection: 0,
            totalCount: 0,
            totalCollection: 0,
            pendingCount: 0,
            pendingCollection: 0,
          };
        }
        
        const isToday = new Date(d.created_at).toDateString() === today;
        acc[vId].totalCount += 1;
        acc[vId].totalCollection += d.paid_amount || 0;
        
        if ((d.pending_amount || 0) > 0) {
          acc[vId].pendingCount += 1;
          acc[vId].pendingCollection += d.pending_amount;
        }
        
        if (isToday) {
          acc[vId].todayCount += 1;
          acc[vId].todayCollection += d.paid_amount || 0;
        }
        
        return acc;
      }, {});
      
      return Object.values(stats) as Array<{
        name: string;
        todayCount: number;
        todayCollection: number;
        totalCount: number;
        totalCollection: number;
        pendingCount: number;
        pendingCollection: number;
      }>;
    },
    enabled: !!year,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useAllPoojaBookings = (year: number) => {
  return useQuery({
    queryKey: ['poojaBookings', year],
    queryFn: async () => {
      const { data: slots, error: slotError } = await supabase
        .from('pooja_slots')
        .select('*');
      if (slotError) throw slotError;

      const { data: bookings, error: bookingError } = await supabase
        .from('pooja_bookings')
        .select('*')
        .eq('year', year);
      
      if (bookingError && bookingError.code !== 'PGRST116') throw bookingError;

      return (slots || []).map(slot => ({
        id: slot.id,
        day: slot.day,
        time: slot.time,
        families: (bookings || []).filter(b => b.slot_id === slot.id),
        reminderRequestedAt: slot.reminderRequestedAt,
      })).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
    },
    enabled: !!year,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, username, email, phone, role, status, photo_url, created_at, approved_at, approved_by, last_login')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useFeedbackQuestions = () => {
  return useQuery({
    queryKey: ['feedbackQuestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_questions')
        .select('id, question, type, options, order, is_active')
        .order('order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useFeedbackMessages = () => {
  return useQuery({
    queryKey: ['feedbackMessages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, name, phone, message, rating, answers, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useReportsData = (yearId: string | undefined, enabled: boolean) => {
  return useQuery({
    queryKey: ['reports', yearId],
    queryFn: async () => {
      if (!yearId) return { devotees: [], expenses: [] };
      
      const [devoteesRes, expensesRes] = await Promise.all([
        supabase.from('devotees').select('id, name, phone, amount_pledged, paid_amount, payment_mode, volunteer_id, volunteer_name, gotram').eq('year_id', yearId),
        supabase.from('expenses').select('id, amount, category, date, payment_mode').eq('year_id', yearId)
      ]);
      
      if (devoteesRes.error) throw devoteesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      
      return {
        devotees: devoteesRes.data || [],
        expenses: expensesRes.data || []
      };
    },
    enabled: !!yearId && enabled,
    staleTime: 10 * 60 * 1000, // Cache report data for 10 minutes once generated
    refetchOnWindowFocus: false,
  });
};

export const useNotifications = (
  role: string | undefined,
  email: string | undefined,
  isRead: boolean | undefined,
  page: number,
  pageSize: number
) => {
  return useQuery({
    queryKey: ['notifications', role, email, isRead, page, pageSize],
    queryFn: async () => {
      if (!role || !email) return { data: [], count: 0 };

      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .contains('audience_roles', [role])
        .order('created_at', { ascending: false });

      if (isRead === true) {
        query = query.contains('read_by', [email]);
      } else if (isRead === false) {
        query = query.not('read_by', 'cs', `{${email}}`);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        data: data || [],
        count: count || 0
      };
    },
    enabled: !!role && !!email,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useRecordsData = (year: number) => {
  return useQuery({
    queryKey: ['recordsData', year],
    queryFn: async () => {
      const [
        { data: devData, error: devError },
        { data: expData, error: expError },
        { data: cultData, error: cultError },
        { data: vipData, error: vipError },
        { data: settings, error: setError },
        { data: poojaSlotsData, error: slotsError },
        { data: poojaBookingsData, error: bookingsError }
      ] = await Promise.all([
        supabase.from('devotees').select('*').eq('year', year),
        supabase.from('expenses').select('*').eq('year', year),
        supabase.from('cultural_events').select('*').eq('year', year),
        supabase.from('vip_gotrams').select('*').eq('year', year),
        supabase.from('app_settings').select('festival_start_date').eq('id', 'app').maybeSingle(),
        supabase.from('pooja_slots').select('*'),
        supabase.from('pooja_bookings').select('*').eq('year', year)
      ]);

      if (devError) throw devError;
      if (expError) throw expError;
      if (cultError) throw cultError;
      if (vipError) throw vipError;
      if (slotsError) throw slotsError;
      
      const mappedDevotees = (devData || []).map(d => ({
        ...d,
        totalAmount: d.total_amount,
        paidAmount: d.paid_amount,
        pendingAmount: d.pending_amount,
        volunteerId: d.volunteer_id,
        volunteerName: d.volunteer_name,
        createdAt: new Date(d.created_at).getTime()
      }));

      const mappedExpenses = (expData || []).map(e => ({
        ...e,
        volunteerName: e.volunteer_name
      }));

      const mappedCultural = (cultData || []).map(c => ({
        ...c,
        gameName: c.game_name,
        winner1: c.winner1,
        winner2: c.winner2
      }));

      const mappedVip = (vipData || []).map(v => ({
        ...v,
        familyMembers: v.family_members || []
      }));

      const mappedPooja = (poojaSlotsData || []).map(slot => ({
        ...slot,
        families: (poojaBookingsData || []).filter(b => b.slot_id === slot.id)
      })).map(p => ({
        ...p,
        family_name: p.families?.[0]?.name,
        manual_date: p.manual_date,
        families: p.families || []
      }));

      return {
        devotees: mappedDevotees,
        expenses: mappedExpenses,
        culturalEvents: mappedCultural,
        vipGotrams: mappedVip,
        festivalStartDate: settings?.festival_start_date || null,
        poojaBookings: mappedPooja
      };
    },
    enabled: !!year,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

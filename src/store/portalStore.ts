import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { QRPortalSettings, FeedbackQuestion } from '../types';
import toast from 'react-hot-toast';

interface PortalState {
  settings: QRPortalSettings | null;
  questions: FeedbackQuestion[];
  isLoading: boolean;
  
  // Public actions
  fetchSettings: () => Promise<void>;
  fetchQuestions: () => Promise<void>;
  
  // Admin actions
  updateSettings: (updates: Partial<QRPortalSettings>) => Promise<boolean>;
  addQuestion: (question: Omit<FeedbackQuestion, 'id' | 'created_at'>) => Promise<boolean>;
  updateQuestion: (id: string, updates: Partial<FeedbackQuestion>) => Promise<boolean>;
  deleteQuestion: (id: string) => Promise<boolean>;
}

export const usePortalStore = create<PortalState>((set, get) => ({
  settings: null,
  questions: [],
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('qr_portal_settings')
        .select('*')
        .eq('id', 'portal')
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        set({ settings: data[0] as QRPortalSettings });
      }
    } catch (error: any) {
      console.error('Error fetching portal settings:', error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchQuestions: async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_questions')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;
      if (data) {
        set({ questions: data as FeedbackQuestion[] });
      }
    } catch (error: any) {
      console.error('Error fetching feedback questions:', error.message);
    }
  },

  updateSettings: async (updates) => {
    try {
      const { data, error } = await supabase
        .from('qr_portal_settings')
        .upsert({ id: 'portal', ...updates })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        set({ settings: data as QRPortalSettings });
        toast.success('Portal settings updated successfully');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error updating portal settings:', error.message);
      toast.error('Failed to update portal settings');
      return false;
    }
  },

  addQuestion: async (question) => {
    try {
      const { data, error } = await supabase
        .from('feedback_questions')
        .insert([question])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        set((state) => ({ questions: [...state.questions, data as FeedbackQuestion] }));
        toast.success('Question added successfully');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error adding question:', error.message);
      toast.error('Failed to add question');
      return false;
    }
  },

  updateQuestion: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('feedback_questions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        set((state) => ({
          questions: state.questions.map((q) => (q.id === id ? (data as FeedbackQuestion) : q)),
        }));
        toast.success('Question updated successfully');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error updating question:', error.message);
      toast.error('Failed to update question');
      return false;
    }
  },

  deleteQuestion: async (id) => {
    try {
      const { error } = await supabase
        .from('feedback_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        questions: state.questions.filter((q) => q.id !== id),
      }));
      toast.success('Question deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting question:', error.message);
      toast.error('Failed to delete question');
      return false;
    }
  },
}));

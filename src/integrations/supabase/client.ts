// Supabase client for Next.js dashboard
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tlilzsovehqryoyywean.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsaWx6c292ZWhxcnlveXl3ZWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjEwOTQsImV4cCI6MjA4MzI5NzA5NH0.H9ke0r2KVKr0EVkk7xADf-tqkQPqpq1EJX5WP5ndEwo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type SupabaseClient = typeof supabase;

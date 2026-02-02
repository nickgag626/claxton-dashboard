// Supabase client for Next.js dashboard
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lzdjuqwizghoowbifuig.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZGp1cXdpemdob293YmlmdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzI4MDksImV4cCI6MjA4NTYwODgwOX0.NjeSA9_NPBq8Qr4MHrwro5XfaDWDXU6CNJXjztmYSic';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type SupabaseClient = typeof supabase;

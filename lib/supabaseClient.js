import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fkiollqbycagkkqmnazu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraW9sbHFieWNhZ2trcW1uYXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MTk1MDMsImV4cCI6MjA2MjI5NTUwM30.bByuLZKi4YKCsfQKn23KmWSuFh7rlptQeDeZppufoBI';
export const supabase = createClient(supabaseUrl, supabaseKey);

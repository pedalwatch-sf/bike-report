import { supabase } from './supabaseClient';

export async function uploadImage(file) {
  const ext = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('submission-images').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('submission-images').getPublicUrl(path);
  return data.publicUrl;
}

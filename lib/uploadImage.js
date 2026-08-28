import { supabase } from './supabaseClient';

export async function uploadImage(file, userId) {
  if (!userId) throw new Error('Sign in before uploading an image.');
  const ext = file.name.split('.').pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('submission-images').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('submission-images').getPublicUrl(path);
  return data.publicUrl;
}


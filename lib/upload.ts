import { createClient } from '@/lib/supabase/client'

export async function uploadFileToSupabase(file: File, folder: string): Promise<string | null> {
  try {
    const supabase = createClient()
    
    // Generate a unique filename to avoid collisions
    const fileExt = file.name.split('.').pop() || ''
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const path = `${folder}/${fileName}`
    
    // Convert file to ArrayBuffer for upload
    const bytes = await file.arrayBuffer()
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('client-documents')
      .upload(path, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: true
      })

    if (error) {
      console.error('Error uploading to Supabase:', error)
      return null
    }

    return path
  } catch (error) {
    console.error('Exception during upload:', error)
    return null
  }
}

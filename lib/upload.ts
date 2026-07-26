import { createClient } from '@/lib/supabase/client'
import { compressImageFile } from '@/lib/utils'

/** Ce qui a réellement été déposé — à enregistrer en base tel quel. Le poids et le
 *  type peuvent différer du fichier choisi, puisqu'une photo est réduite avant envoi. */
export type UploadedFile = { path: string; type: string; size: number }

export async function uploadFileToSupabase(
  file: File,
  folder: string,
  bucket = 'client-documents',
): Promise<UploadedFile | null> {
  try {
    const supabase = createClient()

    // Photo prise au téléphone → réduite à 1920 px avant l'envoi. Les PDF et les
    // fichiers déjà légers passent inchangés (voir `compressImageFile`). L'extension
    // et le type sont lus APRÈS réduction : une photo réduite ressort en .jpg.
    const toSend = await compressImageFile(file)

    // Generate a unique filename to avoid collisions
    const fileExt = toSend.name.split('.').pop() || ''
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const path = `${folder}/${fileName}`

    // Convert file to ArrayBuffer for upload
    const bytes = await toSend.arrayBuffer()

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, {
        contentType: toSend.type || 'application/octet-stream',
        upsert: true
      })

    if (error) {
      console.error('Error uploading to Supabase:', error)
      return null
    }

    return {
      path,
      type: toSend.type || 'application/octet-stream',
      size: toSend.size,
    }
  } catch (error) {
    console.error('Exception during upload:', error)
    return null
  }
}

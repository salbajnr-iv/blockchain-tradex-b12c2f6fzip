import { supabase } from '@/lib/supabaseClient'

// ── fetch the user's latest KYC submission ──────────────────────────────────
export const getLatestKycSubmission = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

// ── upload a file to a storage bucket, returns the storage path ─────────────
export const uploadKycFile = async (bucket, userId, file, fileKey) => {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${fileKey}_${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error
  return path
}

// ── create a new KYC submission ─────────────────────────────────────────────
export const submitKycApplication = async ({
  tier,
  personalInfo,
  documentInfo,
  filePaths,
}) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('kyc_submissions')
    .insert({
      user_id: user.id,
      tier,
      status: 'pending',
      // document paths
      id_document_path:      filePaths.idFront   || null,
      id_back_path:          filePaths.idBack     || null,
      selfie_path:           filePaths.selfie     || null,
      proof_of_address_path: filePaths.address    || null,
      // document metadata
      document_type:    documentInfo.type,
      document_number:  documentInfo.number,
      document_country: documentInfo.country,
      document_expiry:  documentInfo.expiry || null,
      // personal details
      legal_first_name: personalInfo.firstName,
      legal_last_name:  personalInfo.lastName,
      date_of_birth:    personalInfo.dateOfBirth,
      nationality:      personalInfo.nationality,
      address_line1:    personalInfo.addressLine1,
      address_line2:    personalInfo.addressLine2 || null,
      city:             personalInfo.city,
      postal_code:      personalInfo.postalCode,
      country:          personalInfo.country,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ── get a signed URL so the user can view their uploaded doc ─────────────────
export const getKycFileUrl = async (bucket, path) => {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60) // 1 hour
  if (error) return null
  return data.signedUrl
}

// ── subscribe to real-time changes on the user's submission ──────────────────
export const subscribeToKycStatus = (userId, submissionId, onUpdate) => {
  const channel = supabase
    .channel(`kyc:${submissionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'kyc_submissions',
        filter: `id=eq.${submissionId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

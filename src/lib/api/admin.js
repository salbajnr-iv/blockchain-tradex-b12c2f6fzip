import { supabase } from '@/lib/supabaseClient'

// ── Check if the current user is an admin ───────────────────────────────────
export const getAdminStatus = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (error || !data) return false
  return data.is_admin === true
}

// ── Fetch all pending withdrawal transactions (admin only) ───────────────────
export const getPendingWithdrawals = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      portfolios (
        id,
        user_id,
        users ( id, email, full_name, username )
      )
    `)
    .eq('type', 'WITHDRAWAL')
    .eq('status', 'pending')
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ── Fetch ALL withdrawal transactions (admin only) ────────────────────────────
export const getAllWithdrawals = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      portfolios (
        id,
        user_id,
        users ( id, email, full_name, username )
      )
    `)
    .eq('type', 'WITHDRAWAL')
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ── Call the existing fn_admin_update_withdrawal RPC ─────────────────────────
export const adminUpdateWithdrawal = async (transactionId, status, adminMessage = null) => {
  const { error } = await supabase.rpc('fn_admin_update_withdrawal', {
    p_transaction_id: transactionId,
    p_status: status,
    p_admin_message: adminMessage,
  })
  if (error) throw error
}

// ── Fetch all pending KYC submissions (admin only) ───────────────────────────
export const getPendingKycSubmissions = async () => {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select(`
      *,
      users ( id, email, full_name, username )
    `)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ── Fetch all KYC submissions (admin only) ────────────────────────────────────
export const getAllKycSubmissions = async () => {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select(`
      *,
      users ( id, email, full_name, username )
    `)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ── Get signed URLs for KYC document files ────────────────────────────────────
export const getKycDocumentUrls = async (submission) => {
  const bucketMap = {
    id_document_path: 'kyc-documents',
    id_back_path: 'kyc-documents',
    proof_of_address_path: 'kyc-documents',
    selfie_path: 'kyc-selfies',
  }

  const urls = {}
  await Promise.all(
    Object.entries(bucketMap).map(async ([field, bucket]) => {
      const path = submission[field]
      if (!path) return
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60)
      if (!error && data?.signedUrl) urls[field] = data.signedUrl
    })
  )
  return urls
}

// ── Call fn_admin_review_kyc RPC ─────────────────────────────────────────────
export const adminReviewKyc = async (submissionId, status, reviewerNotes = null) => {
  const { error } = await supabase.rpc('fn_admin_review_kyc', {
    p_submission_id: submissionId,
    p_status: status,
    p_reviewer_notes: reviewerNotes,
  })
  if (error) throw error
}

// ── List all registered users (admin only) ───────────────────────────────────
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, username, kyc_tier, kyc_verified, status, is_admin, created_at, last_login')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ── Toggle admin flag on a user ──────────────────────────────────────────────
export const setUserAdminFlag = async (userId, isAdmin) => {
  const { error } = await supabase
    .from('users')
    .update({ is_admin: isAdmin })
    .eq('id', userId)

  if (error) throw error
}

// ── Update user status (active / suspended) ───────────────────────────────────
export const setUserStatus = async (userId, status) => {
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId)

  if (error) throw error
}

// ── Admin dashboard stats ─────────────────────────────────────────────────────
export const getAdminDashboardStats = async () => {
  const [
    { count: pendingWithdrawals },
    { count: pendingKyc },
    { count: totalUsers },
    { data: portfolioSum },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'WITHDRAWAL')
      .eq('status', 'pending'),
    supabase
      .from('kyc_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('portfolios')
      .select('cash_balance, total_value'),
  ])

  const totalPlatformValue = (portfolioSum ?? []).reduce(
    (sum, p) => sum + (Number(p.cash_balance) || 0) + (Number(p.total_value) || 0),
    0
  )

  return {
    pendingWithdrawals: pendingWithdrawals ?? 0,
    pendingKyc: pendingKyc ?? 0,
    totalUsers: totalUsers ?? 0,
    totalPlatformValue,
  }
}

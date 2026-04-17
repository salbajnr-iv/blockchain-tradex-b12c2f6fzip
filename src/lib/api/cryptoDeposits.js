import { supabase } from '@/lib/supabaseClient';

// ── Master Wallets ───────────────────────────────────────────────────────────

export const getMasterWallets = async () => {
  const { data, error } = await supabase
    .from('master_wallets')
    .select('*')
    .eq('is_active', true)
    .order('asset');
  if (error) throw error;
  return data ?? [];
};

export const getAllMasterWallets = async () => {
  const { data, error } = await supabase
    .from('master_wallets')
    .select('*')
    .order('asset');
  if (error) throw error;
  return data ?? [];
};

export const addMasterWallet = async ({ asset, network, address, label }) => {
  const { data, error } = await supabase
    .from('master_wallets')
    .insert({
      asset:     asset.trim().toUpperCase(),
      network:   network.trim(),
      address:   address.trim(),
      label:     label?.trim() || null,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateMasterWallet = async (id, { address, label }) => {
  const { data, error } = await supabase
    .from('master_wallets')
    .update({ address: address?.trim(), label: label?.trim() || null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const toggleMasterWalletActive = async (id, is_active) => {
  const { error } = await supabase
    .from('master_wallets')
    .update({ is_active })
    .eq('id', id);
  if (error) throw error;
};

export const deleteMasterWallet = async (id) => {
  const { error } = await supabase
    .from('master_wallets')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ── User Balances ────────────────────────────────────────────────────────────

export const getUserCryptoBalances = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('user_balances')
    .select('*')
    .eq('user_id', userId)
    .order('asset');
  if (error) throw error;
  return data ?? [];
};

// ── Deposit Submission ───────────────────────────────────────────────────────

export const uploadDepositProof = async (userId, file) => {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('deposit-proofs')
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return path;
};

export const getDepositProofUrl = async (path) => {
  const { data, error } = await supabase.storage
    .from('deposit-proofs')
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (error) throw error;
  return data.signedUrl;
};

export const submitCryptoDeposit = async ({
  userId,
  asset,
  network,
  amount,
  txHash,
  proofFile,
}) => {
  if (!userId) throw new Error('User not authenticated');
  if (!asset || !network) throw new Error('Asset and network are required');
  if (!amount || parseFloat(amount) <= 0) throw new Error('Amount must be greater than 0');

  let proofUrl = null;
  if (proofFile) {
    proofUrl = await uploadDepositProof(userId, proofFile);
  }

  const { data, error } = await supabase
    .from('deposits')
    .insert({
      user_id:   userId,
      asset,
      network,
      amount:    parseFloat(amount),
      tx_hash:   txHash?.trim() || null,
      proof_url: proofUrl,
      status:    'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ── User Deposit History ─────────────────────────────────────────────────────

export const getUserDeposits = async (userId, limit = 50) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

// ── Admin: All Deposits ──────────────────────────────────────────────────────

export const adminGetAllDeposits = async ({ status = null, limit = 100 } = {}) => {
  let query = supabase
    .from('deposits')
    .select(`
      *,
      user:user_id (
        id,
        email,
        full_name,
        username
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

// ── Admin: Approve Deposit ───────────────────────────────────────────────────

export const adminApproveDeposit = async (depositId, adminNote = null) => {
  const { data, error } = await supabase
    .rpc('fn_approve_deposit', {
      p_deposit_id:  depositId,
      p_admin_note:  adminNote,
    });
  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Approval failed');
  return data;
};

// ── Admin: Reject Deposit ────────────────────────────────────────────────────

export const adminRejectDeposit = async (depositId, adminNote) => {
  if (!adminNote?.trim()) throw new Error('Rejection reason is required');
  const { data, error } = await supabase
    .rpc('fn_reject_deposit', {
      p_deposit_id:  depositId,
      p_admin_note:  adminNote.trim(),
    });
  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Rejection failed');
  return data;
};

// ── Admin: Mark Under Review ─────────────────────────────────────────────────

export const adminSetUnderReview = async (depositId) => {
  const { data, error } = await supabase
    .rpc('fn_set_deposit_under_review', { p_deposit_id: depositId });
  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Failed to mark under review');
  return data;
};

// ── Admin: Fetch a single user's crypto balances ─────────────────────────────

export const adminGetUserCryptoBalances = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('user_balances')
    .select('*')
    .eq('user_id', userId)
    .order('asset');
  if (error) throw error;
  return data ?? [];
};

// ── Admin: Adjust a user's crypto balance (add / deduct / set / delete) ──────

export const adminAdjustCryptoBalance = async (userId, asset, operation, amount, note) => {
  const { data, error } = await supabase.rpc('fn_admin_adjust_crypto_balance', {
    p_user_id:   userId,
    p_asset:     asset,
    p_operation: operation,
    p_amount:    operation === 'delete' ? 0 : Number(amount),
    p_note:      note || null,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Balance adjustment failed');
  return data;
};

// ── Admin: Insert/upsert a fresh crypto balance row ──────────────────────────
// (used when creating a balance for an asset the user doesn't have yet)

export const adminSetCryptoBalance = async (userId, asset, amount) => {
  if (!userId || !asset) throw new Error('userId and asset required');
  const { error } = await supabase
    .from('user_balances')
    .upsert({ user_id: userId, asset, balance: Number(amount), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,asset' });
  if (error) throw error;
};

// ── Admin: Delete a specific crypto balance row ───────────────────────────────

export const adminDeleteCryptoBalance = async (userId, asset) => {
  const { error } = await supabase
    .from('user_balances')
    .delete()
    .eq('user_id', userId)
    .eq('asset', asset);
  if (error) throw error;
};

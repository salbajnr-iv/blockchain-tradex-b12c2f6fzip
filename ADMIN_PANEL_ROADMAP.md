# Admin Panel — Concrete Implementation Roadmap

## Overview
BlockTrade already has all the database infrastructure needed for an admin panel:
- `is_admin` boolean column on `public.users`
- `fn_admin_update_withdrawal(transaction_id, status, message)` RPC function
- Admin-specific RLS policies on `transactions` table
- `kyc_submissions` table with `reviewer_notes`, `rejection_reason`, `reviewed_at` columns

What is missing is the **frontend admin UI** and the **KYC review RPC function**.

---

## Phase 1 — Route Guard & Admin Shell

### Files to create
- `src/components/AdminRoute.jsx`  
  A ProtectedRoute variant that also checks `user.is_admin === true`.  
  Redirects non-admins to `/` with a toast.

- `src/pages/admin/AdminLayout.jsx`  
  Sidebar layout for admin area with links to all admin sub-pages.

### Route addition (src/App.jsx)
```jsx
<Route path="/admin" element={<AdminRoute />}>
  <Route element={<AdminLayout />}>
    <Route index element={<AdminDashboard />} />
    <Route path="withdrawals" element={<AdminWithdrawals />} />
    <Route path="kyc" element={<AdminKyc />} />
    <Route path="users" element={<AdminUsers />} />
  </Route>
</Route>
```

---

## Phase 2 — Admin Dashboard Overview

### File: `src/pages/admin/AdminDashboard.jsx`

**Stats cards** (pull via Supabase queries):
- Pending withdrawal count (transactions WHERE type='WITHDRAWAL' AND status='pending')
- Pending KYC submissions count (kyc_submissions WHERE status='pending' OR status='under_review')
- Total users count
- Total portfolio value across all users (aggregate)

**Recent activity feed** — last 10 admin actions from `audit_logs`

---

## Phase 3 — Withdrawal Review

### File: `src/pages/admin/AdminWithdrawals.jsx`

**Table columns:** User, Amount, Method, Submitted at, Status  
**Filters:** pending | approved | rejected | all  
**Actions per row:**
- View full details (withdrawal_details JSON expanded)
- Approve — calls `fn_admin_update_withdrawal(id, 'completed', message)`
- Reject — opens a modal with a required rejection reason field, then calls `fn_admin_update_withdrawal(id, 'rejected', reason)`

**Realtime:** Subscribe to `transactions` table changes so the list auto-refreshes.

### API function to add: `src/lib/api/admin.js`
```js
export const adminUpdateWithdrawal = async (transactionId, status, message) => {
  const { data, error } = await supabase.rpc('fn_admin_update_withdrawal', {
    p_transaction_id: transactionId,
    p_new_status: status,
    p_admin_message: message,
  });
  if (error) throw error;
  return data;
};
```

---

## Phase 4 — KYC Review

### SQL migration needed: `sql/kyc-admin-review.sql`

Add a missing RPC function for KYC review (the data exists but no function):

```sql
CREATE OR REPLACE FUNCTION fn_admin_review_kyc(
  p_submission_id uuid,
  p_status        text,
  p_notes         text DEFAULT NULL,
  p_rejection     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_tier    text;
BEGIN
  -- Validate status
  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT user_id, verification_level INTO v_user_id, v_tier
  FROM public.kyc_submissions WHERE id = p_submission_id;

  UPDATE public.kyc_submissions SET
    status           = p_status,
    reviewer_notes   = p_notes,
    rejection_reason = p_rejection,
    reviewed_at      = now(),
    updated_at       = now()
  WHERE id = p_submission_id;

  -- If approved, update the user's KYC status and tier
  IF p_status = 'approved' THEN
    UPDATE public.users SET
      kyc_verified = true,
      kyc_tier     = COALESCE(v_tier, 'intermediate'),
      updated_at   = now()
    WHERE id = v_user_id;
  ELSIF p_status = 'rejected' THEN
    UPDATE public.users SET
      kyc_verified = false,
      updated_at   = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users (RLS still protects who can call it)
GRANT EXECUTE ON FUNCTION fn_admin_review_kyc TO authenticated;

-- Admin RLS policies for kyc_submissions
CREATE POLICY "Admins can view all KYC submissions"
  ON public.kyc_submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update all KYC submissions"
  ON public.kyc_submissions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );
```

### File: `src/pages/admin/AdminKyc.jsx`

**Table columns:** User, Document Type, Submitted at, Tier, Status  
**Document preview:** Click row to open modal showing the Supabase Storage URLs for:
- ID front image
- ID back image  
- Selfie image
- Proof of address

**Actions per row:**
- Approve — calls `fn_admin_review_kyc(id, 'approved', notes)`
- Reject — modal with required rejection reason, calls `fn_admin_review_kyc(id, 'rejected', notes, reason)`

---

## Phase 5 — User Management

### File: `src/pages/admin/AdminUsers.jsx`

**Table columns:** Username, Email, KYC Tier, Status, Joined, Admin  
**Actions:**
- Suspend / Activate account (UPDATE public.users SET status = ...)
- Grant / Revoke admin (UPDATE public.users SET is_admin = ...)
- View user's portfolio stats inline

---

## Phase 6 — Admin Notifications

When an admin approves or rejects a withdrawal or KYC submission, insert a row into the `notifications` table for the affected user so they receive an in-app notification automatically.

Add this to `fn_admin_update_withdrawal` and `fn_admin_review_kyc`:
```sql
INSERT INTO public.notifications (user_id, type, title, message, created_at)
VALUES (v_user_id, 'admin_action', 'Withdrawal Update', 
        'Your withdrawal of $' || p_amount || ' has been ' || p_new_status, now());
```

---

## Priority Order

| Phase | Effort | Impact |
|-------|--------|--------|
| Phase 1 — Route Guard + Shell | 2h | Blocker for all others |
| Phase 2 — Dashboard Overview | 3h | High — quick wins |
| Phase 3 — Withdrawal Review | 4h | Critical — currently manual |
| Phase 4 — KYC Review | 5h | Critical — requires SQL migration |
| Phase 5 — User Management | 3h | Medium |
| Phase 6 — Notifications | 2h | Polish |

**Total estimated effort: ~19 hours of dev work**

---

## SQL Files Required

| File | Purpose |
|------|---------|
| `sql/kyc-admin-review.sql` | `fn_admin_review_kyc` RPC + admin RLS for kyc_submissions |

All other admin operations use existing functions (`fn_admin_update_withdrawal`) and direct table queries with the existing admin RLS policies.

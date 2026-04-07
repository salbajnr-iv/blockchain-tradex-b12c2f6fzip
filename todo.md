1	Transaction CSV export not implemented	Transactions.jsx	Download icon is imported and the button renders but does nothing — no export logic exists at all
2	Appearance settings are completely dead	settings/Appearance.jsx	Accent colour swatches and all display toggles ("Compact numbers", "Animated charts", etc.) have no onChange handler — clicking them does nothing
3	Duplicate nav items	Layout.jsx	"My Portfolio" and "Transactions" in the sidebar both link to /transactions. One slot is wasted
High — Significant Functional Gaps
#	Gap	Location	Impact
4	Notification preferences only saved to localStorage	settings/NotificationPrefs.jsx	Settings are lost when user switches browser/device or clears storage — no Supabase persistence
5	currentPassword field collected but never verified	settings/Security.jsx	Security page asks for current password before changing it, but the value is never actually sent — anyone can change the password without knowing the old one
6	"Sign Out All Sessions" only signs out current session	settings/Security.jsx	signOut() without scope: 'global' only ends the current tab's session
7	"Delete Account" is permanently disabled	settings/Security.jsx	Button is greyed out with "contact support" — users have no self-serve way to delete their account
8	2FA/MFA is a "coming soon" stub	settings/Security.jsx	The UI element exists but is hardcoded as non-functional
Medium — UX Holes and Feature Stubs
#	Gap	Location	Impact
9	Virtual card details are generated from user ID	Card.jsx	Card number, expiry, and CVV are deterministically computed locally — not from a real issuer
10	No bulk cancel / no edit for limit orders	Orders.jsx	Users must cancel open orders one by one; can't modify price or quantity
11	KYC hardcoded to Intermediate tier only	settings/Kyc.jsx	UI shows Basic/Pro tiers but the form always submits as "Intermediate" regardless
12	No saved withdrawal destinations	Withdrawal.jsx	Users must re-enter full bank/wallet details on every withdrawal request
13	DCA and limit orders only fire while browser is open	useRecurringOrderEngine / usePendingOrderEngine	Client-side engines — if the user closes the tab, scheduled orders won't execute
14	PayPal payment method is just a text field	settings/Payments.jsx	No OAuth or verification — stores an email string with no validation against a real PayPal account
Low — Polish and Validation
#	Gap	Location	Impact
15	Password strength shown but not enforced on register	auth/Register.jsx	Visual strength meter exists, but submission is blocked only at length ≥ 6
16	Reset Password page accessible to anyone	auth/ResetPassword.jsx	No check that the user arrived via a Supabase recovery link
17	No social login (Google / GitHub)	auth/Login.jsx, Register.jsx	No OAuth flow — email/password only
18	Portfolio History chart requires SQL migration	Analytics.jsx	Shows a placeholder until sql/recurring-dca-migration.sql is run in Supabase
19	Admin "Sign Out All" doesn't use global scope	settings/Security.jsx	Shared with main ap
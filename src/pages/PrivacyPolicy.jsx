import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Introduction",
    content: `BlockTrade ("we," "our," or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. By using BlockTrade, you consent to the practices described in this policy. We encourage you to read this document carefully. If you disagree with this policy, please discontinue use of our services.`,
  },
  {
    title: "2. Information We Collect",
    content: `We collect several types of information in connection with your use of BlockTrade:\n\n• Identity Information: Full name, date of birth, government-issued ID documents (for KYC verification).\n• Contact Information: Email address, phone number, and mailing address.\n• Financial Information: Payment method details (encrypted), transaction history, deposit and withdrawal records.\n• Technical Information: IP address, browser type, device identifiers, cookies, and usage logs.\n• Profile Information: Avatar photos, biographical information, and account preferences.\n• Communications: Messages you send to our support team and any feedback you provide.`,
  },
  {
    title: "3. How We Use Your Information",
    content: `We use the information we collect to:\n\n• Provide, operate, and maintain our platform.\n• Process transactions and send related notifications.\n• Verify your identity and comply with KYC/AML obligations.\n• Improve, personalize, and expand our services.\n• Communicate with you about account activity, promotions, and policy updates.\n• Detect, prevent, and address fraud, security incidents, and technical issues.\n• Comply with applicable legal obligations and respond to lawful requests from authorities.`,
  },
  {
    title: "4. Legal Basis for Processing",
    content: `We process your personal data under the following legal bases:\n\n• Contract Performance: Processing necessary to provide our services to you.\n• Legal Obligations: Processing required to comply with applicable laws (e.g., KYC, AML regulations).\n• Legitimate Interests: Processing for fraud prevention, security, and platform improvement, balanced against your rights.\n• Consent: Where we have obtained your explicit consent for specific processing activities.`,
  },
  {
    title: "5. Information Sharing & Disclosure",
    content: `We do not sell your personal information. We may share your information with:\n\n• Service Providers: Third-party vendors who assist in operating the Platform (payment processors, cloud storage, analytics). These parties are bound by confidentiality obligations.\n• Legal Authorities: When required by law, court order, or governmental regulation, or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.\n• Business Transfers: In connection with a merger, acquisition, or sale of assets, where your information may be transferred to the successor entity.\n• With Your Consent: For any other purpose with your explicit consent.`,
  },
  {
    title: "6. Cookies & Tracking Technologies",
    content: `We use cookies and similar tracking technologies to enhance your experience on the Platform. These include:\n\n• Essential Cookies: Required for basic platform functionality and security (cannot be disabled).\n• Analytics Cookies: Help us understand how users interact with the Platform to improve performance.\n• Preference Cookies: Remember your settings and personalization choices.\n\nYou can control cookie preferences through your browser settings, but disabling certain cookies may affect Platform functionality.`,
  },
  {
    title: "7. Data Security",
    content: `We implement industry-standard security measures to protect your information, including 256-bit SSL/TLS encryption for data in transit, AES-256 encryption for sensitive data at rest, regular security audits and penetration testing, multi-factor authentication options, and strict access controls for our team members. While we take all reasonable precautions, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your data.`,
  },
  {
    title: "8. Data Retention",
    content: `We retain your personal information for as long as necessary to fulfill the purposes described in this Privacy Policy, comply with legal obligations, resolve disputes, and enforce our agreements. Account information is retained for a minimum of 5 years after account closure to comply with financial regulations. Transaction records may be retained for up to 7 years. You may request deletion of your data, subject to our legal obligations to retain certain records.`,
  },
  {
    title: "9. Your Rights & Choices",
    content: `Depending on your location, you may have the following rights regarding your personal data:\n\n• Access: Request a copy of the personal information we hold about you.\n• Correction: Request correction of inaccurate or incomplete information.\n• Deletion: Request deletion of your personal data (subject to legal obligations).\n• Portability: Receive your data in a structured, machine-readable format.\n• Objection: Object to certain types of processing, including direct marketing.\n• Restriction: Request we limit how we use your data in certain circumstances.\n\nTo exercise these rights, please contact us at privacy@blocktrade.com.`,
  },
  {
    title: "10. International Data Transfers",
    content: `Your information may be transferred to and processed in countries other than the one in which you reside. These countries may have different data protection laws. When transferring data internationally, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses approved by the relevant authorities, to protect your information in accordance with this Privacy Policy.`,
  },
  {
    title: "11. Children's Privacy",
    content: `BlockTrade is not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that we have inadvertently collected information from someone under 18, we will promptly delete it. If you believe we have collected information from a minor, please contact us immediately.`,
  },
  {
    title: "12. Third-Party Links",
    content: `The Platform may contain links to third-party websites or services. This Privacy Policy does not apply to those external sites. We encourage you to review the privacy policies of any third-party sites you visit. We are not responsible for the privacy practices or content of those sites.`,
  },
  {
    title: "13. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email or through a prominent notice on the Platform. The "Last Updated" date at the top of this policy reflects the most recent revision. Your continued use of the Platform after the effective date of any changes constitutes your acceptance of the updated policy.`,
  },
  {
    title: "14. Contact & Data Protection Officer",
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\nEmail: privacy@blocktrade.com\nData Protection Officer: dpo@blocktrade.com\nSupport Portal: Available after logging into your account\n\nWe will respond to all privacy-related inquiries within 30 days.`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8 mt-1">
          <span className="text-sm text-muted-foreground">BlockTrade Inc.</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-sm text-muted-foreground">Effective Date: January 1, 2025</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-sm text-muted-foreground">Last Updated: April 1, 2025</span>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 mb-8">
          <p className="text-sm text-foreground leading-relaxed">
            Your privacy matters to us. This Privacy Policy describes how BlockTrade collects, uses,
            and protects your personal information. We are committed to transparency and giving you
            control over your data. Please read this document thoroughly.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-card border border-border/50 rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-3">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border/50 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} BlockTrade Inc. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            <span className="text-muted-foreground/40">·</span>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

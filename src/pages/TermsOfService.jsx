import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using BlockTrade ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Platform. These Terms constitute a legally binding agreement between you and BlockTrade. We reserve the right to update these Terms at any time, and continued use of the Platform constitutes acceptance of any changes.`,
  },
  {
    title: "2. Eligibility",
    content: `You must be at least 18 years of age (or the age of majority in your jurisdiction) to use BlockTrade. By using the Platform, you represent and warrant that you meet this requirement and that you are not prohibited from using our services under applicable laws. We reserve the right to request proof of identity and age at any time.`,
  },
  {
    title: "3. Account Registration",
    content: `To access certain features of the Platform, you must create an account. You agree to provide accurate, current, and complete information during registration and to keep your account information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized use of your account.`,
  },
  {
    title: "4. Trading & Financial Services",
    content: `BlockTrade provides a simulated cryptocurrency trading environment. All portfolio values, trades, and financial data presented on the Platform are for informational and educational purposes only. BlockTrade does not constitute a registered broker-dealer, investment adviser, or financial institution. Nothing on the Platform constitutes financial, investment, or trading advice. You acknowledge that cryptocurrency trading involves significant risk, and past performance does not guarantee future results.`,
  },
  {
    title: "5. KYC & Identity Verification",
    content: `To comply with applicable anti-money laundering (AML) and know-your-customer (KYC) regulations, we may require you to complete identity verification before accessing certain features. You agree to provide accurate identification documents when requested. Failure to complete verification may result in restricted access to the Platform. We reserve the right to suspend or terminate accounts that fail verification.`,
  },
  {
    title: "6. Deposits & Withdrawals",
    content: `All deposit and withdrawal requests are subject to review and approval. Processing times may vary depending on the payment method selected. BlockTrade reserves the right to place holds on funds, request additional documentation, or decline transactions at its sole discretion. We are not liable for delays caused by third-party payment processors, banking institutions, or blockchain network congestion.`,
  },
  {
    title: "7. Fees",
    content: `BlockTrade may charge fees for certain services, including but not limited to trading commissions, withdrawal fees, and network transaction fees. All applicable fees will be disclosed to you before completing a transaction. We reserve the right to modify our fee structure at any time, with reasonable notice provided to users. Fees are non-refundable unless otherwise stated.`,
  },
  {
    title: "8. Prohibited Activities",
    content: `You agree not to engage in any of the following activities: (a) market manipulation or fraudulent trading; (b) money laundering, financing of terrorism, or other illegal activities; (c) creating multiple accounts to circumvent restrictions; (d) reverse engineering, hacking, or attempting to compromise the Platform's security; (e) using automated bots or scripts without our express written permission; (f) sharing, selling, or transferring your account to another party.`,
  },
  {
    title: "9. Intellectual Property",
    content: `All content on the Platform, including but not limited to text, graphics, logos, icons, images, audio clips, and software, is the property of BlockTrade or its content suppliers and is protected by applicable intellectual property laws. You may not reproduce, distribute, modify, or create derivative works of any Platform content without our express written permission.`,
  },
  {
    title: "10. Privacy",
    content: `Your use of the Platform is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand our practices. By using the Platform, you consent to the collection, use, and disclosure of your information as described in our Privacy Policy.`,
  },
  {
    title: "11. Disclaimers & Limitation of Liability",
    content: `THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, BLOCKTRADE DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. BLOCKTRADE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM.`,
  },
  {
    title: "12. Indemnification",
    content: `You agree to indemnify, defend, and hold harmless BlockTrade and its officers, directors, employees, agents, and successors from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any way connected with your access to or use of the Platform, your violation of these Terms, or your violation of any third-party rights.`,
  },
  {
    title: "13. Termination",
    content: `We reserve the right to suspend or terminate your account and access to the Platform at any time, with or without cause and with or without notice. Upon termination, your right to use the Platform will immediately cease. All provisions of these Terms that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.`,
  },
  {
    title: "14. Governing Law",
    content: `These Terms shall be governed by and construed in accordance with applicable laws, without regard to its conflict of law provisions. Any dispute arising from or relating to these Terms or the Platform shall be subject to the exclusive jurisdiction of the competent courts in the applicable jurisdiction.`,
  },
  {
    title: "15. Contact Us",
    content: `If you have any questions about these Terms of Service, please contact us at legal@blocktrade.com or through our support portal. We aim to respond to all inquiries within 2 business days.`,
  },
];

export default function TermsOfService() {
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
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
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
            Please read these Terms of Service carefully before using the BlockTrade platform. By
            accessing or using our services, you agree to be legally bound by these terms and all
            policies incorporated herein. If you have any questions, please contact our legal team.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-card border border-border/50 rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-3">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border/50 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} BlockTrade Inc. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            <span className="text-muted-foreground/40">·</span>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Terms of Service — Arkasodhara",
  description:
    "Terms governing your use of Arkasodhara websites, applications, collaboration tools and Google sign-in.",
};

const sections = [
  {
    title: "1. Acceptance of these terms",
    body: [
      "These Terms of Service (\"Terms\") govern your access to and use of arkasodhara.tech and its subdomains, applications and related services (the \"Services\"), including Drawer, Project Tracker, Portfolio, Env Manager, and the Arkasodharas Google sign-in integration.",
      "By accessing or using the Services, you agree to these Terms. If you do not agree, do not use the Services.",
    ],
  },
  {
    title: "2. Eligibility and accounts",
    body: [
      "You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account. If you are younger, you may use the Services only with the involvement and consent of a parent or legal guardian.",
      "You are responsible for the accuracy of your account information, for keeping your Google account and devices secure, and for all activity that occurs through your account. Notify us promptly if you believe your account has been compromised.",
    ],
  },
  {
    title: "3. Google sign-in",
    body: [
      "The Services use Google OAuth to authenticate users. By choosing Google sign-in, you authorise us to receive your name, email address, profile photo, and a Google account identifier solely to create and operate your account.",
      "Your use of Google services is governed by Google's terms and policies. You can revoke our access at any time from your Google Account permissions page.",
    ],
  },
  {
    title: "4. The Services",
    body: [
      "The Services provide tools for creating and sharing diagrams, flows, projects, tasks, documentation, portfolios, environment configuration, images and application builds. We may add, change, suspend or discontinue features from time to time.",
      "Some features may be available only to invited users, team members, administrators, or users with specific roles. Access controls are part of the Services and must not be circumvented.",
    ],
  },
  {
    title: "5. Your content",
    body: [
      "You retain ownership of the content you create or upload, including flows, diagrams, text, images, project data and APK builds (\"Your Content\").",
      "You grant Arkasodhara a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, process, display, transmit, back up and create technical copies of Your Content solely as necessary to provide, secure and improve the Services. This licence ends when Your Content is deleted, except for backups and legal retention.",
      "You represent that you have all rights needed to upload and share Your Content, including any images, documents, software and APK files. You must not upload content that infringes another person's intellectual property, privacy or other rights.",
    ],
  },
  {
    title: "6. Acceptable use",
    body: ["You agree not to:"],
    bullets: [
      "Use the Services for unlawful, fraudulent, harmful or abusive purposes.",
      "Upload malware, malicious code, or APK files you do not own or have permission to distribute.",
      "Attempt to gain unauthorised access to accounts, servers, networks, or other users' content.",
      "Interfere with the availability, integrity or security of the Services.",
      "Scrape, reverse engineer, copy or resell the Services except as permitted by law or with our written consent.",
      "Harass, threaten, impersonate or infringe the rights of others.",
      "Send spam or use the Services to distribute unsolicited commercial communications.",
    ],
  },
  {
    title: "7. Intellectual property",
    body: [
      "The Services, including our software, design, branding, text and documentation (but excluding Your Content), are owned by Arkasodhara or its licensors and are protected by applicable intellectual property laws. These Terms do not transfer ownership of the Services or our trademarks to you.",
    ],
  },
  {
    title: "8. Third-party services",
    body: [
      "The Services rely on third-party providers, including Google for authentication and cloud infrastructure providers for hosting and storage. Your use of those services may be subject to their own terms and policies. We are not responsible for third-party services we do not control.",
    ],
  },
  {
    title: "9. Availability and changes",
    body: [
      "We aim to keep the Services available, but we do not guarantee uninterrupted or error-free operation. The Services may be unavailable during maintenance, updates, outages, or events outside our reasonable control. We may change or discontinue features with reasonable notice where practical.",
    ],
  },
  {
    title: "10. Suspension and termination",
    body: [
      "We may suspend or terminate your access if you violate these Terms, create risk for other users or the Services, or are required to do so by law. You may stop using the Services at any time and request deletion of your account.",
      "On termination, your right to use the Services ends. We may delete Your Content after a reasonable period, except where retention is required for legal, security or backup purposes. You are responsible for exporting content you wish to keep.",
    ],
  },
  {
    title: "11. Disclaimers",
    body: [
      "To the maximum extent permitted by law, the Services are provided \"as is\" and \"as available\", without warranties of any kind, whether express, implied or statutory, including warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, or uninterrupted availability.",
      "We do not warrant that the Services will meet your requirements or that all defects will be corrected. You are responsible for maintaining independent backups of important content.",
    ],
  },
  {
    title: "12. Limitation of liability",
    body: [
      "To the maximum extent permitted by law, Arkasodhara and its team members, contractors and suppliers will not be liable for indirect, incidental, special, consequential, exemplary or punitive damages, or for loss of profits, revenue, data, goodwill or business opportunity, arising out of or related to the Services or these Terms.",
      "Our aggregate liability for all claims relating to the Services will not exceed the greater of the amount you paid us for the Services in the twelve months before the claim, or INR 5,000. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.",
    ],
  },
  {
    title: "13. Indemnity",
    body: [
      "You agree to indemnify and hold harmless Arkasodhara and its team members, contractors and suppliers from claims, losses, liabilities and expenses (including reasonable legal fees) arising from Your Content, your use of the Services, or your violation of these Terms or another person's rights.",
    ],
  },
  {
    title: "14. Governing law and jurisdiction",
    body: [
      "These Terms are governed by the laws of India. Subject to applicable law, the courts located in Bengaluru, Karnataka, India, will have exclusive jurisdiction over disputes arising out of or relating to these Terms or the Services.",
    ],
  },
  {
    title: "15. Changes to these terms",
    body: [
      "We may update these Terms from time to time. The updated version will be posted on this page with a new \"Last updated\" date. If changes are material, we will provide reasonable notice through the Services or by email. Continuing to use the Services after the changes take effect means you accept the updated Terms.",
    ],
  },
  {
    title: "16. Contact",
    body: [
      "For questions about these Terms, contact us at tejasimma36@gmail.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      updated="12 November 2026"
      intro="These Terms govern your use of Arkasodhara websites, applications, collaboration tools and Google sign-in."
      sections={sections}
    />
  );
}

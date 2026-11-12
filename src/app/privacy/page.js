import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Privacy Policy — Arkasodhara",
  description:
    "How Arkasodhara collects, uses, stores and protects information when you use our websites, applications and Google sign-in.",
};

const sections = [
  {
    title: "1. Who we are",
    body: [
      "Arkasodhara (\"Arkasodhara\", \"we\", \"us\" or \"our\") operates arkasodhara.tech and its subdomains, including drawer.arkasodhara.tech, tracker.arkasodhara.tech, env.arkasodhara.tech, folio.arkasodhara.tech and related products (together, the \"Services\").",
      "This Privacy Policy explains what information we collect, why we collect it, how we use and share it, and the choices you have. It applies to the Services and to the Arkasodharas Google OAuth application used to sign in to the Services.",
      "For privacy questions or requests, contact us at tejasimma36@gmail.com.",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "We collect information you provide directly, information created when you use the Services, and limited information received from third-party sign-in providers.",
    ],
    bullets: [
      "Account information: when you sign in with Google, Google provides your name, email address, profile photo, and a Google account identifier. We do not receive or store your Google password.",
      "Content you create: flows, diagrams, teams, invitations, comments, tasks, projects, documentation, portfolio content, uploaded images, files and Android APK builds.",
      "Usage and device information: IP address, browser and device type, operating system, pages or features used, timestamps, error logs, and security events.",
      "Cookie and session information: authentication cookies and short-lived session data needed to keep you signed in and protect your account.",
      "Communications: messages you send to us for support, feedback, or other enquiries.",
    ],
  },
  {
    title: "3. Google user data",
    body: [
      "When you choose \"Sign in with Google\", we receive the profile information described above from Google. We use it only to create your account, authenticate you, display your profile in the Services, and maintain the security of your account.",
      "Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We do not sell Google user data, use it for advertising, or transfer it to third parties except as necessary to provide or secure the Services, comply with law, or with your consent.",
      "You can revoke our access at any time from your Google Account permissions page. Revoking access prevents future Google sign-in but does not automatically delete content already stored in the Services.",
    ],
  },
  {
    title: "4. How we use information",
    bullets: [
      "Provide, operate and maintain the Services.",
      "Create and authenticate accounts and keep sessions secure.",
      "Store, sync, display and share the content you choose to create or collaborate on.",
      "Send service messages, security alerts, and responses to support requests.",
      "Monitor reliability, diagnose errors, prevent abuse, and improve the Services.",
      "Comply with applicable legal obligations and enforce our Terms of Service.",
    ],
  },
  {
    title: "5. Legal bases",
    body: [
      "Where required by law, we rely on one or more legal bases: performance of a contract with you, your consent, our legitimate interests in operating and securing the Services, and compliance with legal obligations.",
    ],
  },
  {
    title: "6. Sharing and disclosure",
    body: [
      "We do not sell personal information. We share information only as described below.",
    ],
    bullets: [
      "Service providers: hosting, storage, database, email delivery, security and technical providers that process information on our behalf under appropriate confidentiality and data-protection terms.",
      "Google: when you use Google sign-in, Google processes authentication data under its own privacy policy.",
      "Other users: content you choose to share with team members, collaborators, or through public links is visible to those people.",
      "Legal and safety: we may disclose information if required by law, legal process, or to protect the rights, safety and security of Arkasodhara, our users, or the public.",
      "Business changes: if the Services or a relevant part of our business are transferred, merged, or reorganised, information may be transferred as part of that transaction, subject to this Privacy Policy.",
    ],
  },
  {
    title: "7. Retention",
    body: [
      "We retain account information and content while your account is active or as needed to provide the Services. If you delete content or request account deletion, we will delete or anonymise it within a reasonable period, except where we must retain it for legal, security, or backup purposes.",
      "Backups may retain copies for a limited period. Server logs and security records are kept only as long as needed for operations and security.",
    ],
  },
  {
    title: "8. Security",
    body: [
      "We use technical and organisational measures designed to protect information, including encrypted connections, access controls, hashed credentials where applicable, and restricted server access. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.",
    ],
  },
  {
    title: "9. Your rights and choices",
    body: [
      "Depending on where you live, you may have the right to access, correct, delete, export, restrict or object to certain processing of your information, and to withdraw consent. To make a request, email tejasimma36@gmail.com. We may need to verify your identity before acting on a request.",
      "You can also manage Google sign-in access from your Google Account permissions page. If you want your account and associated content deleted, contact us and we will help with the process.",
    ],
  },
  {
    title: "10. Cookies",
    body: [
      "We use essential cookies and similar storage to keep you signed in, protect against cross-site request forgery, remember security settings, and maintain sessions. We do not use advertising cookies or sell cookie data. You can block or delete cookies in your browser, but some parts of the Services may stop working.",
    ],
  },
  {
    title: "11. Children",
    body: [
      "The Services are not directed to children under 13. If you are under the age of majority in your jurisdiction, you may use the Services only with the involvement and consent of a parent or legal guardian. If you believe a child has provided personal information, contact us so we can address it.",
    ],
  },
  {
    title: "12. International transfers",
    body: [
      "We are based in India, and our service providers may process information in other countries. Where required, we use appropriate safeguards for cross-border transfers and require providers to protect information consistently with this Privacy Policy.",
    ],
  },
  {
    title: "13. Third-party links",
    body: [
      "The Services may contain links to third-party websites or services. We are not responsible for their privacy practices. Review their privacy policies before providing information to them.",
    ],
  },
  {
    title: "14. Changes to this policy",
    body: [
      "We may update this Privacy Policy from time to time. The updated version will be posted on this page with a new \"Last updated\" date. Material changes will be communicated through the Services or by email where appropriate.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated="12 November 2026"
      intro="This Privacy Policy explains how Arkasodhara handles information when you use our websites, applications, and Google sign-in."
      sections={sections}
    />
  );
}

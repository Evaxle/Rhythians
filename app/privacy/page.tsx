import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy | Rhythians" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div>
        <p className="text-sm font-medium text-accent">Legal</p>
        <h1 className="mt-2 text-4xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-3 text-muted">Last updated: September 8, 2026</p>
      </div>

      <div className="space-y-7 rounded-2xl border border-border bg-surface/70 p-6 text-sm leading-7 text-muted sm:p-8">
        <section><h2 className="mb-2 text-xl font-semibold text-white">Information we collect</h2><p>Rhythians may collect account and profile information you provide, authentication information needed to keep you signed in, community activity such as clips and tournament participation, and technical information needed to operate, secure, and improve the service.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Connected accounts</h2><p>If you choose to connect a third-party account such as Discord, Twitch, or TikTok, Rhythians may receive the account information and permissions you authorize through that service. TikTok information is associated only with the Rhythians account that authorized access. Where enabled, Rhythians may use authorized TikTok profile information and video data to let you display selected TikTok content on your Rhythians profile.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">How information is used</h2><p>We use information to provide profiles, rankings, clips, battles, tournaments, connected-account features, moderation, security, support, and other community functionality. We may also use operational information to diagnose errors, prevent abuse, and maintain the reliability of Rhythians.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Sharing and service providers</h2><p>Rhythians may use service providers to host the website, database, authentication, storage, and integrations. Information may be processed by those providers as necessary to operate Rhythians. We do not sell personal information.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Public information</h2><p>Information you intentionally publish to Rhythians, including public profile information, clips, rankings, and selected connected-account content, may be visible to other users and visitors.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Data retention and account connections</h2><p>We retain information for as long as reasonably necessary to operate Rhythians, meet security requirements, and resolve disputes. You can disconnect supported third-party accounts through Rhythians when that option is available. Disconnecting an integration stops future access through that connection, subject to data already retained for legitimate operational or legal purposes.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Security</h2><p>We use reasonable technical and organizational safeguards intended to protect account and service information. No internet service can guarantee absolute security.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Third-party services</h2><p>Third-party services connected to Rhythians have their own terms and privacy practices. Your use of Discord, Twitch, TikTok, and other external services remains subject to their respective policies.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Changes to this policy</h2><p>We may update this Privacy Policy as Rhythians changes. The current version and its update date will be published on this page.</p></section>
        <section><h2 className="mb-2 text-xl font-semibold text-white">Contact</h2><p>Questions or requests concerning this Privacy Policy can be submitted through the Rhythians community or official support channels.</p></section>
      </div>
    </div>
  );
}

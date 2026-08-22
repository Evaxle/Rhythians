import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Rhythians",
  description: "Terms of Service for Rhythians.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-10">
      <div className="border-b border-border pb-6">
        <p className="text-sm font-medium text-muted">Effective August 22, 2026 · Version 2026-08-22</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Rhythians Terms of Service</h1>
        <p className="mt-4 text-base leading-7 text-muted">These Terms of Service explain the rules for using Rhythians, including accounts, community features, clips, maps, moderation, and content submitted by users.</p>
      </div>

      <div className="prose prose-invert mt-8 max-w-none prose-headings:text-white prose-p:text-muted prose-li:text-muted prose-a:text-white">
        <h2>1. Acceptance of these Terms</h2>
        <p>By creating, accessing, or using a Rhythians account, you agree to these Terms of Service and the rules that apply to the website. If you do not agree, do not create or use an account. When required, you must actively accept the current version before continuing to use account features.</p>

        <h2>2. What Rhythians is</h2>
        <p>Rhythians is a community website that provides social, competitive, informational, and media features for its users. Features may include profiles, clips, posts, comments, rankings, maps, seasonal paths, leaderboards, RHP, tags, coaching features, and integrations with other services. Features may change, be removed, or become unavailable.</p>

        <h2>3. Accounts and account security</h2>
        <p>You are responsible for the activity performed through your account and for keeping your login credentials secure. Do not share credentials, impersonate another person, or use another person's account without permission. You must provide information that is reasonably accurate when creating or maintaining an account.</p>

        <h2>4. Age and permission to use the service</h2>
        <p>You may use Rhythians only if you are legally permitted to enter into these Terms and use the service where you live. If you are under the age required to independently agree to online services in your jurisdiction, you must have the permission of a parent or legal guardian where required by law. Do not use Rhythians if doing so would violate a law or restriction that applies to you.</p>

        <h2>5. Community conduct</h2>
        <p>You agree not to use Rhythians to harass, threaten, stalk, impersonate, defraud, or deliberately harm another person. You may not use the service to distribute unlawful material, malicious code, spam, scams, hateful abuse, sexually exploitative material, or content that violates another person's rights. Attempts to bypass moderation, manipulate rankings, exploit bugs, or interfere with the operation of the website are prohibited.</p>

        <h2>6. User content</h2>
        <p>You retain ownership of original content you submit to Rhythians, except for third-party material included in that content. By submitting content, you grant Rhythians a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, distribute, and technically modify that content as reasonably necessary to operate and promote the service. You represent that you have the rights necessary to submit the content and grant this license.</p>
        <p>Do not upload content that you do not have permission to use. Rhythians may remove content that violates these Terms, applicable rules, third-party rights, or the safety of the community.</p>

        <h2>7. Rhythia maps and third-party data</h2>
        <p>Rhythians may display, reference, import, synchronize, or otherwise use maps, map metadata, rankings, ratings, player data, and other information originating from <a href="https://www.rhythia.com" target="_blank" rel="noreferrer">Rhythia</a>. Rhythia maps and Rhythia-originated data are not claimed as original Rhythians works and remain attributable to Rhythia and their respective creators or rights holders. Rhythians does not transfer ownership of that third-party material to users.</p>
        <p>Rhythians may provide links, integrations, downloads, or references that depend on Rhythia or other third-party services. Those services may have their own terms, availability, and rules. Use of third-party services is subject to their applicable terms.</p>

        <h2>8. Copyright and intellectual property</h2>
        <p>Unless otherwise stated, the original Rhythians website software, interface, original written content, original graphics, branding, layout, and other original materials created for Rhythians are the works of the Rhythians project and are protected by applicable intellectual-property laws. You may not copy, republish, sell, redistribute, or create a competing service from Rhythians original materials without permission, except where applicable law permits it.</p>
        <p>Third-party names, logos, maps, game data, media, and other materials remain the property of their respective owners. Nothing on Rhythians grants ownership of third-party intellectual property.</p>

        <h2>9. Maps, rankings, RHP, tags, and seasonal features</h2>
        <p>Competitive values and community features such as RHP, ranks, ratings, tags, seasonal path progress, leaderboards, and awards are provided for the Rhythians community. They may be recalculated, corrected, reset, removed, or changed when needed to correct errors, prevent abuse, maintain balance, or reflect changes in upstream data. No competitive value has cash value unless Rhythians explicitly states otherwise.</p>

        <h2>10. Moderation and enforcement</h2>
        <p>Rhythians may moderate accounts and content to protect the community and operate the service. Depending on the circumstances, actions may include removing content, limiting features, issuing warnings, suspending accounts, or permanently terminating access. Attempts to evade a restriction may result in additional enforcement.</p>

        <h2>11. Security and prohibited technical activity</h2>
        <p>You may not probe, scan, attack, overload, reverse engineer, exploit, or interfere with Rhythians systems except where Rhythians has expressly authorized the activity. Do not attempt to access private data, administrative functionality, credentials, API secrets, or another user's account.</p>

        <h2>12. Availability and changes</h2>
        <p>Rhythians is provided on an evolving basis. We do not promise that every feature will always be available, uninterrupted, secure, or error-free. We may change, suspend, or discontinue parts of the service at any time.</p>

        <h2>13. Disclaimer</h2>
        <p>To the extent permitted by applicable law, Rhythians is provided on an “as is” and “as available” basis without warranties that the service will meet every user's requirements or operate without interruption or errors. Information imported from third parties may be incomplete, delayed, inaccurate, or changed by its source.</p>

        <h2>14. Limitation of liability</h2>
        <p>To the maximum extent permitted by applicable law, Rhythians and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from or related to use of the service. Nothing in these Terms limits liability that cannot legally be limited or excluded.</p>

        <h2>15. Privacy</h2>
        <p>Your use of Rhythians may involve the collection and processing of account, usage, and community information needed to operate the service. Any separate privacy notice published by Rhythians forms part of the information governing use of the service. Do not submit sensitive personal information that Rhythians does not need.</p>

        <h2>16. Changes to these Terms</h2>
        <p>We may update these Terms when the service, laws, or operating requirements change. When a material update requires renewed acceptance, the website will ask you to accept the new version before you continue using your account. The version and effective date shown at the top identify the current Terms.</p>

        <h2>17. Termination</h2>
        <p>You may stop using your account at any time. Rhythians may suspend or terminate access when these Terms or applicable rules are violated, when necessary to protect the service or users, or when continued operation of an account is no longer appropriate.</p>

        <h2>18. General terms</h2>
        <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in effect to the extent permitted by law. A failure to enforce a provision is not a waiver of the right to enforce it later. These Terms, together with applicable posted rules and policies, describe the agreement governing your use of Rhythians.</p>

        <h2>19. Contact</h2>
        <p>Questions about these Terms or requests concerning the service can be directed through the official Rhythians community or contact method provided on the website.</p>
      </div>

      <div className="mt-10 border-t border-border pt-6 text-sm text-muted">
        <Link href="/" className="text-white hover:underline">Return to Rhythians</Link>
      </div>
    </article>
  );
}

**Last Updated:** May 15, 2025

Jonathan Yoder, operating as Euphonic Intelligence ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, share, and retain your information when you use the Euphonic Intelligence application (the "Application" or "Service").

Please read this Privacy Policy carefully. By accessing or using the Application, you agree to the collection and use of information in accordance with this policy. This Privacy Policy should be read in conjunction with our End-User License Agreement (EULA).

## 1. Information We Collect and Use

We collect the following types of information:

    a. **Information from Spotify:** When you connect your Spotify account to our Service, we request your authorization to access certain information from your Spotify account via the Spotify API. We only request the permissions (OAuth scopes) necessary to provide the features of our Service. This includes:
        *   **Spotify Authentication Tokens**: Access and refresh tokens from Spotify to authenticate you and access your Spotify data on your behalf and to maintain your login session. These are stored securely in your session.
        *   **Spotify Library**: We use the `user-library-read` scope to access your "Liked Songs" which we then parse and send to Google's Gemini API. This allows us to understand your musical preferences and create custom playlists using your saved songs. It also allows you to have an engaging conversation with Gemini regarding your music.
        *   **Spotify Playlists**: We use the `playlist-read-private` and `playlist-read-collaborative` scopes to access your playlists which we then parse and send to Google's Gemini API. This allows us to understand your musical preferences and create playlists using the songs from your existing playlists.
        *   **Search for an Item**: We use the `user-read-private` scope to search for songs on Spotify which helps us to create playlists for our users.
        *   **Playlist Creation**: We use the `playlist-modify-private` and `playlist-modify-public` scopes to create new public and private playlists on your behalf (when you request and approve our doing so).

    b. **User Input Data:**
        *   **Chat History**: The history of your conversation with the AI, including your messages and the AI's responses, will be stored in your session data for continuity during your active use.

    c. **Automatically Collected Technical and Usage Data (Session Data):**
        *   **Session Identifiers**: We use essential cookies to manage your session and keep it secure (e.g., `sessionid`, `csrftoken`).
        *   **Track List**: A simplified version of your Spotify track list (generated using your "Liked Songs" and/or saved playlists) will be cached in your session to improve performance during your active use of the Application.
        *   **Technical Information**: IP address, browser type, operating system, device information, and access times may be logged and used to improve Euphonic Intelligence.
        *   **Usage Patterns**: Pages viewed, features used, how you interact with the Application, performance metrics, and error logs may be logged and used to improve Euphonic Intelligence.

NOTE: SPOTIFY DATA, INCLUDING BUT NOT LIMITED TO YOUR "LIKED SONGS" AND SAVED PLAYLISTS, IS NEVER RETAINED BY OR INGESTED BY THE AI MODEL (GEMINI) AS PER THE TERMS OF EUPHONIC INTELLIGENCE'S PARTNERSHIP WITH GOOGLE. WHEN YOU USE THE APPLICATION, INDIVIDUAL STATELESS REQUESTS ARE MADE TO GEMINI'S API, BUT THIS DATA IS NEVER STORED ON GEMINI'S SERVERS AND IS NEVER USED FOR TRAINING PURPOSES BY GOOGLE.

## 2. How We Share Your Information

We do not sell your personal information. We share your information only in the following limited circumstances:

    a. **With Google (Gemini API):**
        *   To provide the core AI chat and music analysis features, we send your Spotify library information (as a structured string of track names and artists) and your chat messages/prompts to Google's Gemini API for processing.
        *   Google's use of this data is governed by Google's API Terms of Service and Privacy Policy. We send system instructions and user prompts to the Gemini model. As stated above, Google is not authorized to retain this data or use this data for training purposes.
    b. **With Spotify:**
        *   We interact with the Spotify API to authenticate you, access your authorized library data, and perform actions on your behalf (such as saving playlists). Our interactions are governed by your authorizations and Spotify's Developer Terms. We do not share your private chat messages or Gemini responses directly back to Spotify unless it's an explicit action you take (e.g., creating a new playlist based on a chat message from Gemini).
    c. **Legal Requirements:**
        *   We may disclose your information if required to do so by law or in the good faith belief that such action is necessary to comply with a legal obligation, protect and defend our rights or property, prevent or investigate possible wrongdoing in connection with the Service, protect the personal safety of users of the Service or the public, or protect against legal liability.

We do **not** share your information with advertisers, data brokers, or other marketing platforms for their independent use.

## 3. Data Retention

We retain your information as follows:

    a. **Spotify Authentication Tokens (Access and Refresh):** Stored securely in your session. They are retained until they expire according to Spotify's policies, you log out of our Application (which flushes the session), a token refresh fails (at which point the existing tokens are purged and replaced), or when your session expires (automatically occurs after two weeks).
    b. **Cached Spotify Track List/Library Data:** Stored in your session for performance during your active use and cleared when you log out or when your session expires (automatically occurs after two weeks).
    c. **Chat History:** Stored in your session for continuity during your active use and cleared when you log out or when your session expires (automatically occurs after two weeks).
    d. **Session Data (General):** All session data (including the items described above) is cleared when you log out or when your session expires (automatically occurs after two weeks).

## 4. Cookies and Tracking Technologies

a. **Essential/Application Cookies**  
   * **Session Cookies** (`sessionid`): Maintains your logged-in state and stores session data (tokens, cached library, chat history).
   * **CSRF Cookies** (`csrftoken`): Used for Cross-Site Request Forgery protection.

   These cookies are essential. They are set with `HttpOnly`, `Secure` (HTTPS only), and `SameSite='Lax'`.

b. **Third-Party Cookies (Operational)**
   * **Spotify** may set cookies on its own domain when you authenticate. See [Spotify’s Cookie Policy](https://www.spotify.com/legal/cookies/) for details.
   * **CDNs** (jsdelivr for `marked.js`/`DOMPurify`) may use cookies strictly for their operational purposes.

c. **Your Options for Cookie Management**
   You can manage cookie preferences in your browser settings. Blocking essential cookies may impair functionality.

We do **not** set any preference cookies or use analytics cookies for tracking.

## 5. Your Data Rights and Choices

You have control over your information and certain rights depending on your jurisdiction. These may include the right to:

*   Access, correct, or update your personal data.
*   Request the deletion of your personal data.
*   Object to or restrict our processing of your personal data.
*   Withdraw consent at any time (for processing based on consent).

To exercise any rights or for data-related questions:
    a. **Logging out and revoking application authorization**
        1. If you seek to purge your data from Euphonic Intelligence, click the "Logout" button in the top right-hand corner. This flushes all of your session data (Spotify data, chat history, etc.) from our server.
        2. If you seek to revoke Euphonic Intelligence's status as an authorized app in your Spotify account, navigate to https://www.spotify.com/us/account/overview/, click "Manage apps" and click "Remove Access" next to "Euphonic Intelligence."
    b. **Request Data Deletion:**
        *   After logging out and removing Euphonic Intelligence from your authorized apps, if you believe any residual data tied to your past usage might remain, or if you wish to confirm deletion, you can request the complete deletion of all your personal data associated with Euphonic Intelligence.
        *   To do so, please send an email to jyoder433@gmail.com with the subject line 'Data Deletion Request'.
        *   Upon receiving a deletion request, we will remove all your identifiable personal data from our active systems within 5 business days, subject to any legal retention obligations.
    c. **Contact Us for Data Questions or to Exercise Rights:**
        *   If you have any questions about your data, how to exercise your rights, or this Privacy Policy, please contact us at: **jyoder433@gmail.com**.

## 6. Security of Your Information

We take reasonable administrative, technical, and physical measures to protect your information from unauthorized access, loss, theft, misuse, disclosure, alteration, and destruction. This includes using HTTPS for data transmission and secure cookie flags. However, no internet-based service or electronic storage can be 100% secure, so we cannot guarantee absolute security.

## 7. Children's Privacy

The Application is not directed to, nor intended for use by, children under the age of 13 (or the equivalent minimum age in the relevant jurisdiction if higher). We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child without verification of parental consent, we will take steps to remove that information from our systems. If you are a parent or guardian and you are aware that your child has provided us with Personal Data, please contact us.

## 8. International Data Transfers

Your information, including personal data, may be transferred to — and maintained on — computers and servers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those in your jurisdiction. If you are located outside the United States and choose to provide information to us, please note that we transfer the data, including personal data, to the United States and process it there, as well as potentially in other locations where our service providers (like Google for Gemini API) operate.

Your use of the Service followed by your submission of such information represents your agreement to that transfer. We will take steps reasonably necessary to ensure that your data is treated securely and in accordance with this Privacy Policy and applicable data protection laws.

## 9. Spotify as Third-Party Beneficiary

You acknowledge and agree that Spotify is a third-party beneficiary of this Privacy Policy. As such, Spotify shall have the right (and will be deemed to have accepted the right) to enforce any provisions of this Privacy Policy that relate to the Spotify Platform, Spotify Content, or Spotify Personal Data directly against you.

## 10. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, service offerings, or legal requirements. We will notify you of any material changes by posting the new Privacy Policy within the Application or on our website and updating the "Last Updated" date at the top of this Privacy Policy. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page. Your continued use of the Application after such changes indicates your acceptance of the revised policy.

## 11. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us at:
Email: **jyoder433@gmail.com**

By using Euphonic Intelligence, you signify your acceptance of this Privacy Policy. If you do not agree to these terms, please do not use our Service.
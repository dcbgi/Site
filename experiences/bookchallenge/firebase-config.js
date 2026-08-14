// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyAk2mwdXLPXdhEDlkcvu-ucZoGmvdAJx5I",
  authDomain: "bookchallenge-8d47e.firebaseapp.com",
  projectId: "bookchallenge-8d47e",
  storageBucket: "bookchallenge-8d47e.firebasestorage.app",
  messagingSenderId: "486738090491",
  appId: "1:486738090491:web:f6217b2391a8909484135e",
  measurementId: "G-HCB2X09CJL"
};

// App Check (reCAPTCHA v3) — stops the public config/API key above from being
// used by scripts or apps other than this actual deployed site, even though
// the key itself isn't secret. Setup:
//   1. Firebase console → Build → App Check → register this web app →
//      choose "reCAPTCHA v3" → it creates a site key for you (or link an
//      existing one from https://www.google.com/recaptcha/admin).
//   2. Paste that site key below, replacing the placeholder.
//   3. Deploy the site with the real key live BEFORE doing step 4.
//   4. Back in App Check → APIs tab → find Cloud Firestore → click
//      "Enforce". (Enforcing before step 3 is deployed will break writes
//      for everyone, since their browsers won't have a valid App Check
//      token yet.)
export const recaptchaSiteKey = "hhhhhhhjjjjjjj";

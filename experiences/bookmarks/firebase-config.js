// For Firebase JS SDK v7.20.0 and later, measurementId is optional
//
// ── Bookmarks: one-time Firebase setup ──────────────────────────────────────
// This page keeps every signed-in person's bookmarks PRIVATE to their own
// Google account. To make that real (not just hidden in the UI), Firestore
// security rules must enforce it. Steps:
//
//   1. Firebase console → add a project (or reuse an existing one) → add a
//      Web App → copy its config object and paste it over the placeholder
//      below.
//   2. Build → Authentication → Sign-in method → enable **Google**.
//   3. Build → Firestore Database → Create database (production mode).
//   4. Firestore → Rules → publish these rules so each account can only ever
//      read/create/update its OWN bookmarks. Note there is NO `delete`: this
//      app never deletes bookmarks (the ✕ button only HIDES them by setting a
//      `hidden` flag via update), so every bookmark is kept permanently.
//
//        rules_version = '2';
//        service cloud.firestore {
//          match /databases/{database}/documents {
//            match /bookmarks/{id} {
//              allow read, update: if request.auth != null
//                                  && resource.data.ownerUid == request.auth.uid;
//              allow create:       if request.auth != null
//                                  && request.resource.data.ownerUid == request.auth.uid;
//            }
//          }
//        }
//
//   5. Deploy. Until this file is filled in, the page shows a friendly
//      "not configured yet" notice instead of breaking.
//
// NOTE: a Firebase web config is NOT a secret — it ships in every visitor's
// browser. The security rules above are what actually protect the data.
export const firebaseConfig = {
  apiKey: "AIzaSyCTTSWN6-nLATpvj1mTZZfIISKktpgNxXQ",
  authDomain: "bkmk-8471d.firebaseapp.com",
  projectId: "bkmk-8471d",
  storageBucket: "bkmk-8471d.firebasestorage.app",
  messagingSenderId: "461128812944",
  appId: "1:461128812944:web:80dae93aab8f89c3b10b15",
  measurementId: "G-002X5YTLWL"
};

// ── Owner identity ───────────────────────────────────────────────────────────
// Your own Google account email. When YOU sign in, your full personal bookmark
// set (my-bookmarks.js) is seeded into your private list on first use. Everyone
// else who signs in just gets the small welcome/recommendations set. Leave blank
// to disable owner seeding entirely (no one gets the personal set).
export const OWNER_EMAIL = "deiondreaberry@gmail.com";


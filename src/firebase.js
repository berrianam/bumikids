import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAHVlwFs62Nz6rjw6I4X-PppPgqfIcFHG4',
  authDomain: 'bumikids-87a28.firebaseapp.com',
  projectId: 'bumikids-87a28',
  storageBucket: 'bumikids-87a28.firebasestorage.app',
  messagingSenderId: '586063745229',
  appId: '1:586063745229:web:7b5cbcc734489d288bd984',
  measurementId: 'G-N1VF5R7CWB'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const initAnalytics = async () => {
  if (typeof window === 'undefined') return null;
  if (!(await isAnalyticsSupported())) return null;
  return getAnalytics(app);
};

export { app, db, initAnalytics };

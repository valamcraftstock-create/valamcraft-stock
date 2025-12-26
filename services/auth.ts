
import { AdminUser } from '../types';

// --- FIREBASE IMPORT (Re-use if available) ---
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID
};

let db: any = null;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "your_api_key") {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
  }
} catch (e) {
  // Ignore error if already initialized in storage.ts or config missing
}

const USERS_KEY = 'stockflow_users_db';
const SESSION_KEY = 'stockflow_active_session';

// --- SYNC USERS ---
const syncUsersToCloud = async (users: AdminUser[]) => {
    if(!db) return;
    try {
        // We store users in a separate collection "admin_users" document "main"
        // Note: In a real production app, use Firebase Auth directly. 
        // This maintains the requested architecture of shared password locking.
        await setDoc(doc(db, "admin_users", "main"), { users }, { merge: true });
    } catch(e) { console.error("Auth Sync Fail", e); }
};

const syncUsersFromCloud = async () => {
    if(!db) return;
    try {
        const snap = await getDoc(doc(db, "admin_users", "main"));
        if(snap.exists()) {
            const data = snap.data();
            if(data && data.users) {
                localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
            }
        }
    } catch(e) { console.error("Auth Fetch Fail", e); }
}

export const getCurrentUser = (): string | null => {
  return localStorage.getItem(SESSION_KEY);
};

export const login = (email: string, password: string): boolean => {
  // Attempt Cloud Sync before login to get latest passwords
  if(navigator.onLine && db) {
      syncUsersFromCloud(); 
  }

  const usersStr = localStorage.getItem(USERS_KEY);
  if (!usersStr) return false;

  const users: AdminUser[] = JSON.parse(usersStr);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);
  
  if (user) {
    localStorage.setItem(SESSION_KEY, user.email);
    return true;
  }
  return false;
};

export const register = (email: string, password: string): boolean => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: AdminUser[] = usersStr ? JSON.parse(usersStr) : [];

  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return false; // User exists
  }

  const newUser: AdminUser = {
    email,
    passwordHash: password,
    lastLogin: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(SESSION_KEY, email); // Auto login
  
  if(db) syncUsersToCloud(users);
  
  return true;
};

export const logout = () => {
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
};

export const verifyCurrentPassword = (password: string): boolean => {
  const email = getCurrentUser();
  if (!email) return false;
  
  const usersStr = localStorage.getItem(USERS_KEY);
  if (!usersStr) return false;

  const users: AdminUser[] = JSON.parse(usersStr);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  return user ? user.passwordHash === password : false;
};

export const updateUserPassword = (newPassword: string): boolean => {
  const email = getCurrentUser();
  if (!email) return false;

  const usersStr = localStorage.getItem(USERS_KEY);
  if (!usersStr) return false;

  const users: AdminUser[] = JSON.parse(usersStr);
  const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (userIndex === -1) return false;

  users[userIndex].passwordHash = newPassword;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  
  // Sync new password to cloud
  if(db) syncUsersToCloud(users);

  return true;
};

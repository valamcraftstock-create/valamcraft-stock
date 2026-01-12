
import { Product, Transaction, AppState, Customer, StoreProfile } from '../types';
import { getCurrentUser } from './auth';

// --- FIREBASE CONFIGURATION ---
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, enableIndexedDbPersistence } from 'firebase/firestore';

// Support both common environment variable patterns for Netlify/Vite/CRA
const getEnv = (key: string) => {
    // @ts-ignore
    return (typeof process !== 'undefined' ? process.env[key] : null) || (import.meta && (import.meta as any).env ? (import.meta as any).env[key] : null);
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

let db: any = null;
let isCloudSynced = false; // Guard flag to prevent overwriting cloud with empty local data

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "your_api_key") {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      enableIndexedDbPersistence(db).catch((err: any) => {
          console.warn('Persistence warning:', err.code);
      });
  }
} catch (e) {
  console.warn("Firebase Init Error (Running Offline Mode):", e);
}

const getStorageKey = () => {
  const user = getCurrentUser();
  return user ? `stockflow_data_v10_${user}` : 'stockflow_data_v10_guest';
};

const defaultProfile: StoreProfile = {
  storeName: "StockFlow Demo",
  ownerName: "Admin",
  gstin: "",
  email: "admin@stockflow.app",
  phone: "",
  addressLine1: "123 Business St",
  addressLine2: "City Center",
  state: "Gujarat",
  defaultTaxRate: 0,
  defaultTaxLabel: 'None'
};

const initialData: AppState = {
  products: [],
  transactions: [],
  categories: [],
  customers: [],
  profile: defaultProfile
};

const syncFromCloud = async () => {
    if (!db) return;
    const user = getCurrentUser();
    if (!user) return;
    try {
        const docRef = doc(db, "stores", user);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const cloudData = docSnap.data() as AppState;
            const localDataStr = localStorage.getItem(getStorageKey());
            
            // Critical: If cloud has data and local is empty or different, pull it
            if (JSON.stringify(cloudData) !== localDataStr) {
                localStorage.setItem(getStorageKey(), JSON.stringify(cloudData));
                window.dispatchEvent(new Event('local-storage-update'));
            }
            isCloudSynced = true; // Successfully confirmed cloud state
        } else {
            // Document doesn't exist yet, we can safely sync up local data later
            isCloudSynced = true;
        }
    } catch (e) { 
        console.error("Error fetching from cloud:", e); 
    }
};

const syncToCloud = async (data: AppState) => {
    if (!db || !isCloudSynced) return; // DON'T sync up if we haven't confirmed cloud state first
    const user = getCurrentUser();
    if (!user) return;
    try { 
        await setDoc(doc(db, "stores", user), data, { merge: true }); 
    } catch (e) { 
        console.error("Error syncing to cloud:", e); 
    }
};

let hasInitialSynced = false;

export const loadData = (): AppState => {
  try {
    const data = localStorage.getItem(getStorageKey());
    
    if (db && !hasInitialSynced && navigator.onLine) {
        hasInitialSynced = true;
        syncFromCloud();
    }
    
    if (!data) return initialData;
    
    const parsed = JSON.parse(data);
    if (!parsed.categories) parsed.categories = [];
    if (!parsed.customers) parsed.customers = [];
    if (!parsed.profile) parsed.profile = defaultProfile;
    if (parsed.profile.defaultTaxRate === undefined) {
        parsed.profile.defaultTaxRate = 0;
        parsed.profile.defaultTaxLabel = 'None';
    }
    return parsed;
  } catch (e) {
    console.error("Failed to load data", e);
    return initialData;
  }
};

export const saveData = (data: AppState) => {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
    window.dispatchEvent(new Event('local-storage-update'));
    
    // Cloud sync only if we have a valid reason (e.g. not empty or after sync)
    if (db) syncToCloud(data);
  } catch (e) { 
    console.error("Failed to save data", e); 
  }
};

export const updateStoreProfile = (profile: StoreProfile) => {
    const data = loadData();
    saveData({ ...data, profile });
};

export const resetData = () => {
    localStorage.removeItem(getStorageKey());
    window.location.reload();
};

export const addProduct = (product: Product): Product[] => {
  const data = loadData();
  const newProduct = { ...product, totalSold: 0 };
  const newProducts = [...data.products, newProduct];
  saveData({ ...data, products: newProducts });
  return newProducts;
};

export const updateProduct = (product: Product): Product[] => {
  const data = loadData();
  const newProducts = data.products.map(p => p.id === product.id ? product : p);
  saveData({ ...data, products: newProducts });
  return newProducts;
};

export const deleteProduct = (id: string): Product[] => {
  const data = loadData();
  const newProducts = data.products.filter(p => p.id !== id);
  saveData({ ...data, products: newProducts });
  return newProducts;
};

export const addCategory = (category: string): string[] => {
  const data = loadData();
  if (data.categories.some(c => c.toLowerCase() === category.toLowerCase())) {
      return data.categories;
  }
  const newCategories = [...data.categories, category].sort();
  saveData({ ...data, categories: newCategories });
  return newCategories;
};

export const deleteCategory = (category: string): string[] => {
  const data = loadData();
  const newCategories = data.categories.filter(c => c !== category);
  saveData({ ...data, categories: newCategories });
  return newCategories;
};

export const addCustomer = (customer: Customer): Customer[] => {
    const data = loadData();
    const newCustomer = { ...customer, totalDue: 0 };
    const newCustomers = [...data.customers, newCustomer];
    saveData({ ...data, customers: newCustomers });
    return newCustomers;
}

export const deleteCustomer = (id: string): Customer[] => {
    const data = loadData();
    const newCustomers = data.customers.filter(c => c.id !== id);
    saveData({ ...data, customers: newCustomers });
    return newCustomers;
}

export const processTransaction = (transaction: Transaction): AppState => {
  const data = loadData();
  const newTransactions = [transaction, ...data.transactions];
  let newProducts = [...data.products];
  if (transaction.type !== 'payment') {
      newProducts = data.products.map(p => {
        const itemInCart = transaction.items.find(i => i.id === p.id);
        if (itemInCart) {
          const qty = itemInCart.quantity;
          if (transaction.type === 'sale') {
            return { ...p, stock: p.stock - qty, totalSold: (p.totalSold || 0) + qty };
          } else {
            return { ...p, stock: p.stock + qty, totalSold: Math.max(0, (p.totalSold || 0) - qty) };
          }
        }
        return p;
      });
  }
  let newCustomers = [...data.customers];
  if (transaction.customerId) {
      const customerIndex = newCustomers.findIndex(c => c.id === transaction.customerId);
      if (customerIndex >= 0) {
          const c = newCustomers[customerIndex];
          let newTotalSpend = c.totalSpend;
          let newTotalDue = c.totalDue;
          let newVisitCount = c.visitCount;
          let newLastVisit = c.lastVisit;
          const amount = Math.abs(transaction.total);
          if (transaction.type === 'sale') {
              newTotalSpend += amount;
              newVisitCount += 1;
              newLastVisit = new Date().toISOString();
              if (transaction.paymentMethod === 'Credit') newTotalDue += amount;
          } else if (transaction.type === 'return') {
              newTotalSpend -= amount;
              if (transaction.paymentMethod === 'Credit') newTotalDue -= amount;
          } else if (transaction.type === 'payment') {
              newTotalDue -= amount;
              newLastVisit = new Date().toISOString();
          }
          newCustomers[customerIndex] = { ...c, totalSpend: newTotalSpend, totalDue: newTotalDue, visitCount: newVisitCount, lastVisit: newLastVisit };
      }
  }
  const newState = { ...data, products: newProducts, transactions: newTransactions, customers: newCustomers };
  saveData(newState);
  return newState;
};

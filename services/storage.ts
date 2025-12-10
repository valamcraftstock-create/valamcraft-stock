
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot, 
    writeBatch, 
    query, 
    where,
    getDoc,
    orderBy
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Product, Transaction, AppState, Customer, StoreProfile } from '../types';
import { onAuthStateChanged } from 'firebase/auth';

// --- INITIAL STATE ---
const defaultProfile: StoreProfile = {
  storeName: "My Store",
  ownerName: "Admin",
  gstin: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  state: "",
};

const initialData: AppState = {
  products: [],
  transactions: [],
  categories: [],
  customers: [],
  profile: defaultProfile,
  isLoading: true
};

const StockFlowContext = createContext<AppState>(initialData);

export const useStockFlow = () => useContext(StockFlowContext);

export const StockFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [data, setData] = useState<AppState>(initialData);
    const [user, setUser] = useState<any>(null);

    // 1. Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) {
                setData({ ...initialData, isLoading: false });
            }
        });
        return unsubscribe;
    }, []);

    // 2. Data Listeners (Only when user is logged in)
    useEffect(() => {
        if (!user) return;

        const uid = user.uid;
        setData(prev => ({ ...prev, isLoading: true }));

        // References
        const productsRef = collection(db, 'users', uid, 'products');
        const transactionsRef = collection(db, 'users', uid, 'transactions');
        const customersRef = collection(db, 'users', uid, 'customers');
        const settingsRef = doc(db, 'users', uid, 'settings', 'profile');
        const categoriesRef = doc(db, 'users', uid, 'settings', 'categories');

        const handleError = (context: string) => (error: any) => {
            console.error(`Error syncing ${context}:`, error);
            // If permission denied, it likely means Firestore Rules are not published
            if (error.code === 'permission-denied') {
                console.warn("Check your Firestore Security Rules!");
            }
        };

        // A. Profile Listener
        const unsubProfile = onSnapshot(settingsRef, (doc) => {
            if (doc.exists()) {
                setData(prev => ({ ...prev, profile: doc.data() as StoreProfile }));
            } else {
                // Create default if missing
                setDoc(settingsRef, defaultProfile);
            }
        }, handleError("Profile"));

        // B. Categories Listener
        const unsubCategories = onSnapshot(categoriesRef, (doc) => {
            if (doc.exists()) {
                setData(prev => ({ ...prev, categories: doc.data().list || [] }));
            } else {
                setDoc(categoriesRef, { list: [] });
            }
        }, handleError("Categories"));

        // C. Products Listener
        const unsubProducts = onSnapshot(productsRef, (snapshot) => {
            const list: Product[] = [];
            snapshot.forEach(doc => list.push(doc.data() as Product));
            setData(prev => ({ ...prev, products: list }));
        }, handleError("Products"));

        // D. Customers Listener
        const unsubCustomers = onSnapshot(customersRef, (snapshot) => {
            const list: Customer[] = [];
            snapshot.forEach(doc => list.push(doc.data() as Customer));
            setData(prev => ({ ...prev, customers: list }));
        }, handleError("Customers"));

        // E. Transactions Listener
        // Order by date descending to show newest first
        // Note: This requires an index in Firestore usually, but for single user collection it's often auto-handled.
        // If it fails, fallback to client sort.
        const txQuery = query(transactionsRef, orderBy('date', 'desc'));
        
        const unsubTransactions = onSnapshot(txQuery, (snapshot) => {
            const list: Transaction[] = [];
            snapshot.forEach(doc => list.push(doc.data() as Transaction));
            setData(prev => ({ ...prev, transactions: list, isLoading: false }));
        }, (error) => {
            console.warn("Index needed or permission error on Transactions. Fallback to unordered.");
            // Fallback for no index
            onSnapshot(transactionsRef, (snap) => {
                const list: Transaction[] = [];
                snap.forEach(doc => list.push(doc.data() as Transaction));
                list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setData(prev => ({ ...prev, transactions: list, isLoading: false }));
            });
        });

        // Cleanup: Unsubscribe on unmount to prevent memory leaks
        return () => {
            unsubProfile();
            unsubCategories();
            unsubProducts();
            unsubCustomers();
            unsubTransactions();
        };
    }, [user]);

    return React.createElement(StockFlowContext.Provider, { value: data }, children);
};

// --- CRUD OPERATIONS (FIRESTORE) ---

const getUid = () => {
    if (!auth.currentUser) throw new Error("User not authenticated");
    return auth.currentUser.uid;
};

export const updateStoreProfile = async (profile: StoreProfile) => {
    const uid = getUid();
    await setDoc(doc(db, 'users', uid, 'settings', 'profile'), profile);
};

export const addCategory = async (category: string) => {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'settings', 'categories');
    const snap = await getDoc(ref);
    const currentList = snap.exists() ? snap.data().list || [] : [];
    if (!currentList.includes(category)) {
        await setDoc(ref, { list: [...currentList, category] });
    }
};

export const deleteCategory = async (category: string) => {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'settings', 'categories');
    const snap = await getDoc(ref);
    const currentList = snap.exists() ? snap.data().list || [] : [];
    await setDoc(ref, { list: currentList.filter((c: string) => c !== category) });
};

export const addProduct = async (product: Product) => {
    const uid = getUid();
    await setDoc(doc(db, 'users', uid, 'products', product.id), product);
};

export const updateProduct = async (product: Product) => {
    const uid = getUid();
    await setDoc(doc(db, 'users', uid, 'products', product.id), product);
};

export const deleteProduct = async (id: string) => {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'products', id));
};

export const addCustomer = async (customer: Customer) => {
    const uid = getUid();
    await setDoc(doc(db, 'users', uid, 'customers', customer.id), customer);
};

// --- ROBUST TRANSACTION HANDLING ---
export const processTransaction = async (transaction: Transaction) => {
    const uid = getUid();
    const batch = writeBatch(db);

    // 1. Create Transaction Record
    const txRef = doc(db, 'users', uid, 'transactions', transaction.id);
    batch.set(txRef, transaction);

    // 2. Update Product Stocks
    for (const item of transaction.items) {
        const productRef = doc(db, 'users', uid, 'products', item.id);
        const delta = item.quantity;
        const newStock = transaction.type === 'sale' ? item.stock - delta : item.stock + delta;
        const newTotalSold = transaction.type === 'sale' 
            ? (item.totalSold || 0) + delta 
            : (item.totalSold || 0) - delta;

        batch.update(productRef, { 
            stock: newStock,
            totalSold: newTotalSold
        });
    }

    // 3. Update Customer Stats
    if (transaction.customerId) {
        const customerRef = doc(db, 'users', uid, 'customers', transaction.customerId);
        const { increment } = await import('firebase/firestore'); 
        
        const amount = transaction.type === 'sale' ? transaction.total : -Math.abs(transaction.total);
        
        batch.update(customerRef, {
            totalSpend: increment(amount),
            visitCount: increment(1),
            lastVisit: new Date().toISOString()
        });
    }

    await batch.commit();
};

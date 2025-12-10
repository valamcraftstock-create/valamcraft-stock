
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail, 
    updatePassword as firebaseUpdatePassword,
    onAuthStateChanged,
    User
} from "firebase/auth";
import { auth } from "./firebase";

// Subscribe to Auth Changes
export const subscribeToAuth = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

// Login
export const login = async (email: string, password: string): Promise<boolean> => {
    await signInWithEmailAndPassword(auth, email, password);
    return true;
};

// Register
export const register = async (email: string, password: string): Promise<boolean> => {
    await createUserWithEmailAndPassword(auth, email, password);
    return true;
};

// Logout
export const logout = async () => {
    await signOut(auth);
};

// Reset Password (Email)
export const sendPasswordReset = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

// Update Password (Logged in)
export const updatePassword = async (newPassword: string): Promise<void> => {
    if (!auth.currentUser) throw { code: 'auth/no-current-user' };
    await firebaseUpdatePassword(auth.currentUser, newPassword);
};

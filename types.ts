
export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  image: string; // Base64 or URL
  category: string;
  totalSold?: number; // Tracks net quantity sold for return validation
  hsn?: string;
}

export interface CartItem extends Product {
  quantity: number;
  discountPercent?: number;
  discountAmount?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalSpend: number;
  lastVisit: string; // ISO Date
  visitCount: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  date: string; // ISO string
  type: 'sale' | 'return';
  customerId?: string;
  customerName?: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
}

export interface StoreProfile {
  storeName: string;
  ownerName: string;
  gstin: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  state: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankHolder?: string;
  signatureImage?: string; // Base64
}

export interface AdminUser {
  email: string;
  passwordHash: string; // In real app, never store plain text
  lastLogin: string;
}

export interface AppState {
  products: Product[];
  transactions: Transaction[];
  categories: string[];
  customers: Customer[];
  profile: StoreProfile;
  isLoading?: boolean;
}

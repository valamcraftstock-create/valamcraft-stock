import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Transactions from './pages/Transactions';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import { getCurrentUser, verifyCurrentPassword, logout } from './services/auth';
import { loadData } from './services/storage';
import { LayoutDashboard, ShoppingCart, FileText, Package, ArrowRightLeft, Users, ScanQrCode, RotateCcw, Layers, Menu, X, Settings as SettingsIcon, Lock, Unlock, Shield, LogOut } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from './components/ui';

// --- Components ---

const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
        isActive 
          ? 'bg-primary text-primary-foreground' 
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
};

const QuickLink = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    return (
      <Link 
        to={to} 
        className="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

const MenuController = ({ setIsMenuOpen }: { setIsMenuOpen: (open: boolean) => void }) => {
    const location = useLocation();
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);
    return null;
};

// --- Admin Guard Component ---
// Improved typing using React.FC to handle children correctly in modern TypeScript/React
interface AdminGuardProps {
    children: React.ReactNode;
    isUnlocked: boolean;
    onUnlock: (pwd: string) => boolean;
}

const AdminGuard: React.FC<AdminGuardProps> = ({ children, isUnlocked, onUnlock }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (isUnlocked) return <>{children}</>;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onUnlock(password)) {
            setError('');
        } else {
            setError('Incorrect Admin Password');
            setPassword('');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-[80vh] w-full p-4 animate-in fade-in duration-500">
            <Card className="w-full max-w-sm shadow-2xl border-t-4 border-t-red-600">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
                        <Lock className="w-8 h-8 text-red-600" />
                    </div>
                    <CardTitle className="text-xl">Admin Access Locked</CardTitle>
                    <p className="text-sm text-muted-foreground">Enter your admin password to continue</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            type="password" 
                            placeholder="Admin Password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)}
                            autoFocus
                            className="text-center text-lg"
                        />
                        {error && <p className="text-xs text-red-500 font-medium text-center animate-pulse">{error}</p>}
                        <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700 text-white">
                            Unlock
                        </Button>
                        <div className="relative flex items-center gap-2 py-2">
                            <div className="h-px bg-border flex-1"></div>
                            <span className="text-[10px] text-muted-foreground">OR</span>
                            <div className="h-px bg-border flex-1"></div>
                        </div>
                        <Button type="button" variant="ghost" onClick={logout} className="w-full text-muted-foreground hover:text-destructive">
                            <LogOut className="w-4 h-4 mr-2" /> Logout
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};


export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getCurrentUser());
  const [storeName, setStoreName] = useState('StockFlow');
  
  // Admin Lock State - Explicit boolean typing to improve inference
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);

  useEffect(() => {
      if (isAuthenticated) {
          const data = loadData();
          setStoreName(data.profile.storeName || 'StockFlow');
      }
      
      const handleStorageUpdate = () => {
         const data = loadData();
         setStoreName(data.profile.storeName || 'StockFlow');
      };
      
      window.addEventListener('local-storage-update', handleStorageUpdate);
      return () => window.removeEventListener('local-storage-update', handleStorageUpdate);
  }, [isAuthenticated]);

  const handleUnlockAdmin = (password: string) => {
      if (verifyCurrentPassword(password)) {
          setIsAdminUnlocked(true);
          return true;
      }
      return false;
  };

  const handleLoginSuccess = () => {
      setIsAuthenticated(true);
      // Unlock admin automatically on fresh login
      setIsAdminUnlocked(true);
  };

  const handleLockAdmin = () => {
      setIsAdminUnlocked(false);
  };

  if (!isAuthenticated) {
      return <Auth onLogin={handleLoginSuccess} />;
  }

  return (
    <Router>
      <MenuController setIsMenuOpen={setIsMenuOpen} />
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r bg-card flex flex-col hidden md:flex">
          <div className="p-6">
            <h1 className="text-xl font-bold flex items-center gap-2 truncate" title={storeName}>
              <Package className="w-8 h-8 text-primary shrink-0" />
              {storeName}
            </h1>
          </div>
          
          <nav className="flex-1 px-4 space-y-1">
            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2">Menu</p>
            <NavItem to="/" icon={LayoutDashboard} label="Inventory" />
            <NavItem to="/sales" icon={ShoppingCart} label="POS System" />
            <NavItem to="/transactions" icon={ArrowRightLeft} label="Transactions" />
            <NavItem to="/customers" icon={Users} label="Customers" />
            <NavItem to="/pdf" icon={FileText} label="Reports" />
            <NavItem to="/settings" icon={SettingsIcon} label="Settings" />

            <div className="pt-6">
                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
                <QuickLink to="/sales?mode=scan" icon={ScanQrCode} label="Scan to Sell" />
                <QuickLink to="/sales?mode=return_scan" icon={RotateCcw} label="Scan Return" />
                <QuickLink to="/sales?mode=bulk_scan" icon={Layers} label="Bulk Scan" />
            </div>
          </nav>
          
          <div className="p-4 border-t flex flex-col gap-2">
             {isAdminUnlocked ? (
                 <Button variant="outline" size="sm" onClick={handleLockAdmin} className="w-full text-xs gap-2 border-red-200 text-red-600 hover:bg-red-50">
                     <Lock className="w-3 h-3" /> Lock Admin
                 </Button>
             ) : (
                 <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
                     <Lock className="w-3 h-3" /> Admin Locked
                 </div>
             )}
             <div className="text-xs text-muted-foreground mt-2">
                <p>User: {getCurrentUser()}</p>
             </div>
          </div>
        </div>

        {/* Mobile Navigation (Bottom) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t h-16 flex items-center justify-around px-2 z-50 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
           <Link to="/" className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Stock</span>
           </Link>
           <Link to="/sales" className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">POS</span>
           </Link>
           
           <div className="relative -top-5">
              <Link to="/sales?mode=scan" className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform border-4 border-background active:scale-95">
                  <ScanQrCode className="w-7 h-7" />
              </Link>
           </div>

           <Link to="/customers" className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Clients</span>
           </Link>

           <button onClick={() => setIsMenuOpen(true)} className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">More</span>
           </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col justify-end animate-in slide-in-from-bottom-10" onClick={() => setIsMenuOpen(false)}>
                <div className="bg-card rounded-t-2xl p-6 space-y-4 pb-8" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-lg">Menu</h3>
                        <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(false)}><X className="w-5 h-5" /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <Link to="/transactions" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-2">
                                  <ArrowRightLeft className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Transactions</span>
                         </Link>
                         <Link to="/pdf" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-purple-100 text-purple-600 rounded-full mb-2">
                                  <FileText className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Reports</span>
                         </Link>
                         <Link to="/settings" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-gray-100 text-gray-600 rounded-full mb-2">
                                  <SettingsIcon className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Settings</span>
                         </Link>
                         
                         {isAdminUnlocked ? (
                             <button onClick={handleLockAdmin} className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-200">
                                  <div className="p-3 bg-white text-red-600 rounded-full mb-2 shadow-sm">
                                      <Lock className="w-6 h-6" />
                                  </div>
                                  <span className="font-medium text-sm text-red-700">Lock Admin</span>
                             </button>
                         ) : (
                             <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-xl border border-dashed">
                                  <div className="p-3 bg-muted text-muted-foreground rounded-full mb-2">
                                      <Lock className="w-6 h-6" />
                                  </div>
                                  <span className="font-medium text-sm text-muted-foreground">Admin Locked</span>
                             </div>
                         )}
                    </div>
                </div>
            </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="h-full p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto">
            <Routes>
              {/* Protected Routes */}
              <Route path="/" element={<AdminGuard isUnlocked={isAdminUnlocked} onUnlock={handleUnlockAdmin}><Admin /></AdminGuard>} />
              <Route path="/transactions" element={<AdminGuard isUnlocked={isAdminUnlocked} onUnlock={handleUnlockAdmin}><Transactions /></AdminGuard>} />
              <Route path="/customers" element={<AdminGuard isUnlocked={isAdminUnlocked} onUnlock={handleUnlockAdmin}><Customers /></AdminGuard>} />
              <Route path="/pdf" element={<AdminGuard isUnlocked={isAdminUnlocked} onUnlock={handleUnlockAdmin}><Reports /></AdminGuard>} />
              <Route path="/settings" element={<AdminGuard isUnlocked={isAdminUnlocked} onUnlock={handleUnlockAdmin}><Settings /></AdminGuard>} />
              
              {/* Unprotected Route (POS) */}
              <Route path="/sales" element={<Sales />} />
              
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Transactions from './pages/Transactions';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import AuthPage from './pages/Auth';
import { subscribeToAuth, logout } from './services/auth';
import { StockFlowProvider, useStockFlow } from './services/storage';
import { LayoutDashboard, ShoppingCart, FileText, Package, ArrowRightLeft, Users, ScanQrCode, RotateCcw, Layers, Menu, X, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { Button } from './components/ui';

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

// Wrapper to consume Data Context for Store Name
const SidebarHeader = () => {
    const { profile } = useStockFlow();
    return (
        <div className="p-6">
            <h1 className="text-xl font-bold flex items-center gap-2 truncate" title={profile.storeName}>
              <Package className="w-8 h-8 text-primary shrink-0" />
              {profile.storeName || "StockFlow"}
            </h1>
        </div>
    );
}

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const unsubscribe = subscribeToAuth((u) => {
          setUser(u);
          setLoading(false);
      });
      return unsubscribe;
  }, []);

  if (loading) {
      return (
          <div className="h-screen flex items-center justify-center bg-background">
              <div className="animate-pulse flex flex-col items-center">
                  <Package className="w-12 h-12 text-primary mb-4" />
                  <p className="text-muted-foreground">Loading StockFlow...</p>
              </div>
          </div>
      )
  }

  if (!user) {
      return <AuthPage />;
  }

  return (
    <StockFlowProvider>
        <Router>
        <MenuController setIsMenuOpen={setIsMenuOpen} />
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r bg-card flex flex-col hidden md:flex">
            <SidebarHeader />
            
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
            
            <div className="p-4 border-t text-xs text-muted-foreground">
                <p className="truncate">{user.email}</p>
                <button onClick={() => logout()} className="mt-2 text-destructive hover:underline flex items-center gap-1">
                   <LogOut className="w-3 h-3" /> Logout
                </button>
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
                            <Link to="/sales?mode=return_scan" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                                <div className="p-3 bg-orange-100 text-orange-600 rounded-full mb-2">
                                    <RotateCcw className="w-6 h-6" />
                                </div>
                                <span className="font-medium text-sm">Scan Return</span>
                            </Link>
                        </div>
                        <Button variant="destructive" onClick={logout} className="w-full">
                            Logout
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-background">
            <div className="h-full p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto">
                <Routes>
                <Route path="/" element={<Admin />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/pdf" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
            </main>
        </div>
        </Router>
    </StockFlowProvider>
  );
}

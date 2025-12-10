import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Product, CartItem, Transaction, Customer } from '../types';
import { useStockFlow, processTransaction, addCustomer } from '../services/storage';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Badge, Label, Switch } from '../components/ui';
import { ShoppingCart, Trash2, Scan, RotateCcw, X, Plus, Minus, Search, Camera, AlertCircle, CheckCircle, Ban, Maximize2, Minimize2, ChevronDown, ChevronUp, Share2, Printer, Layers, Package, IndianRupee, Tag, FileText, Keyboard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// --- Modern Product Card Component ---
const ProductGridItem: React.FC<{ product: Product, isReturnMode: boolean, onAdd: (qty: number) => void }> = ({ product, isReturnMode, onAdd }) => {
    const [qty, setQty] = useState(1);
    const [flashMsg, setFlashMsg] = useState<string | null>(null);

    const isOutOfStock = !isReturnMode && product.stock <= 0;
    const maxReturnable = product.totalSold || 0;
    const canReturn = isReturnMode && maxReturnable > 0;
    
    // Status Logic
    const isLowStock = !isReturnMode && product.stock > 0 && product.stock < 5;

    const handleAdd = () => {
        if (isOutOfStock && !isReturnMode) return;
        
        if (isReturnMode && qty > maxReturnable) {
            setFlashMsg(`Limit: ${maxReturnable}`);
            setTimeout(() => setFlashMsg(null), 1500);
            return;
        }
        
        onAdd(qty);
        setQty(1);
        
        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const isDisabled = (isOutOfStock && !isReturnMode) || (isReturnMode && !canReturn);

    return (
        <div 
            className={`group relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 ${isDisabled ? 'opacity-60 grayscale' : 'hover:shadow-md hover:border-primary/50'}`}
            onClick={() => !isDisabled && handleAdd()} 
        >
            <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-muted">
                {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary/50">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                )}
                
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                    ₹{product.sellPrice}
                </div>

                <div className="absolute top-2 right-2">
                    {isReturnMode ? (
                        <Badge variant={canReturn ? "secondary" : "outline"} className="text-[10px] h-5 bg-white/90 backdrop-blur-md shadow-sm border-0">
                            Sold: {maxReturnable}
                        </Badge>
                    ) : (
                        <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm ${isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-orange-500' : 'bg-green-500'}`} />
                    )}
                </div>
                
                {flashMsg && (
                    <div className="absolute inset-0 bg-red-600/90 flex items-center justify-center text-white font-bold text-xs p-2 text-center animate-in fade-in">
                        {flashMsg}
                    </div>
                )}
            </div>

            <div className="flex flex-1 flex-col p-3">
                <div className="mb-2">
                    <h3 className="font-semibold text-xs sm:text-sm leading-tight line-clamp-2" title={product.name}>{product.name}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{product.sku}</p>
                </div>

                <div className="mt-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg shrink-0" onClick={() => setQty(Math.max(1, qty - 1))} disabled={isDisabled}><Minus className="w-3 h-3" /></Button>
                    <Input type="number" className="h-7 w-full min-w-[1.5rem] text-center px-0 text-xs border-0 bg-secondary/50 focus-visible:ring-0 rounded-lg" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))} disabled={isDisabled} onClick={e => e.stopPropagation()} />
                    <Button variant="default" size="icon" className={`h-7 w-7 rounded-lg shrink-0 ${isReturnMode ? 'bg-orange-600 hover:bg-orange-700' : ''}`} onClick={handleAdd} disabled={isDisabled}><Plus className="w-3 h-3" /></Button>
                </div>
            </div>
        </div>
    );
};

export default function Sales() {
  const { products, customers, transactions, profile } = useStockFlow();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const cartRef = useRef<CartItem[]>([]);

  const [productSearch, setProductSearch] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanLocked = useRef(false);
  const [scanMessage, setScanMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const isMounted = useRef(false);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [bulkModal, setBulkModal] = useState<{ isOpen: boolean, product: Product | null }>({ isOpen: false, product: null });
  const [transactionComplete, setTransactionComplete] = useState<Transaction | null>(null);
  const [bulkQty, setBulkQty] = useState<number>(1);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [enableGst, setEnableGst] = useState(false);

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'scan') { setIsReturnMode(false); setIsBulkMode(false); setIsScanning(true); }
    else if (mode === 'return_scan') { setIsReturnMode(true); setIsBulkMode(false); setCart([]); setIsScanning(true); }
    else if (mode === 'bulk_scan') { setIsReturnMode(false); setIsBulkMode(true); setIsScanning(true); }
  }, [searchParams]);

  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { if (cartError) { const t = setTimeout(() => setCartError(null), 3000); return () => clearTimeout(t); } }, [cartError]);

  useEffect(() => {
      let html5QrCode: Html5Qrcode | null = null;
      const cleanup = async () => { if (html5QrCode && html5QrCode.isScanning) { try { await html5QrCode.stop(); html5QrCode.clear(); } catch (e) { console.error(e); } } };
      const startCamera = async () => {
          if (!document.getElementById("reader")) { if(isMounted.current) setTimeout(() => startCamera(), 100); return; }
          try {
              if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current.clear(); }
              html5QrCode = new Html5Qrcode("reader");
              scannerRef.current = html5QrCode;
              await html5QrCode.start({ facingMode: "environment" } as any, { fps: 10, qrbox: { width: 280, height: 280 } }, (decodedText) => { if (isMounted.current) handleProductSelect(decodedText, true); }, () => { });
          } catch (err) { if (isMounted.current) setScanMessage({ type: 'error', text: "Camera Error" }); }
      };
      if (isScanning) startCamera();
      return () => { cleanup(); scannerRef.current = null; };
  }, [isScanning]);

  const handleCloseScanner = () => { setIsScanning(false); navigate('/sales'); };

  const handleProductSelect = (skuOrId: string, isScan = false, explicitQty: number = 1) => {
    if (isScan && isScanLocked.current) return;
    let targetSku = skuOrId;
    try { const p = JSON.parse(skuOrId); if (p.sku) targetSku = p.sku; } catch(e) {}
    const product = products.find(p => p.sku.toLowerCase() === targetSku.toLowerCase() || p.id === targetSku);
    
    if (product) {
        const currentCart = cartRef.current;
        const inCart = currentCart.find(c => c.id === product.id)?.quantity || 0;
        let error = null;
        if (isReturnMode) {
            const sold = product.totalSold || 0;
            if (sold === 0) error = "Item hasn't been sold yet.";
            else if (sold < (inCart + explicitQty)) error = `Return Limit (${sold}) Exceeded!`;
        } else {
            if (product.stock <= 0) error = "Out of Stock!";
            else if (product.stock < (inCart + explicitQty)) error = `Only ${product.stock} in stock.`;
        }
        if (error) {
            if (isScan) { isScanLocked.current = true; setScanMessage({ type: 'error', text: error }); setTimeout(() => { setScanMessage(null); isScanLocked.current = false; }, 2500); } 
            else { setCartError(error); }
            return;
        }
        if (navigator.vibrate) navigator.vibrate(100);
        if (isBulkMode && isScan) { setBulkModal({ isOpen: true, product }); setBulkQty(1); } 
        else { addToCart(product, explicitQty); if (isScan) { isScanLocked.current = true; setScanMessage({ type: 'success', text: `${product.name} Added` }); setTimeout(() => { setScanMessage(null); isScanLocked.current = false; }, 1500); } }
    } else {
        if (isScan) { isScanLocked.current = true; setScanMessage({ type: 'error', text: "Unknown Product" }); setTimeout(() => { setScanMessage(null); isScanLocked.current = false; }, 2000); }
    }
  };

  const addToCart = (product: Product, qty: number) => {
    setCart(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + qty } : item);
        return [...prev, { ...product, quantity: qty, discountPercent: 0, discountAmount: 0 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
      const item = cart.find(i => i.id === id);
      const product = products.find(p => p.id === id);
      if (!item || !product) return;
      const newQty = item.quantity + delta;
      if (newQty <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
      if (delta > 0) {
          if (isReturnMode) {
              const sold = product.totalSold || 0;
              if (sold < newQty) { setCartError(`Max return quantity: ${sold}`); return; }
          } else {
              if (product.stock < newQty) { setCartError(`Stock limit: ${product.stock}`); return; }
          }
      }
      setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));
  };

  const updateDiscount = (id: string, val: string | number, type: 'percent' | 'amount') => {
      const numVal = parseFloat(val.toString()) || 0;
      setCart(prev => prev.map(i => {
          if (i.id !== id) return i;
          let newPercent = i.discountPercent || 0;
          let newAmount = i.discountAmount || 0;
          const gross = i.sellPrice * i.quantity;
          if (type === 'percent') {
              newPercent = Math.min(100, Math.max(0, numVal));
              newAmount = (gross * newPercent) / 100;
          } else {
              newAmount = Math.min(gross, Math.max(0, numVal));
              newPercent = gross > 0 ? (newAmount / gross) * 100 : 0;
          }
          return { ...i, discountPercent: newPercent, discountAmount: newAmount };
      }));
  };

  const initiateCheckout = () => {
      if (cart.length === 0) return;
      setCustomerSearch(''); setFirstName(''); setLastName(''); setNewCustomerPhone('');
      setSelectedCustomer(null); setCheckoutError(null); setIsCustomerModalOpen(true);
  };

  const createCustomer = async () => {
      setCheckoutError(null);
      if (!firstName || !lastName || !newCustomerPhone) { setCheckoutError("Please fill in First Name, Last Name, and Phone."); return; }
      if (!/^\d{10}$/.test(newCustomerPhone)) { setCheckoutError("Phone number must be exactly 10 digits."); return; }
      const existing = customers.find(c => c.phone === newCustomerPhone);
      if (existing) { setCheckoutError(`Customer already exists: ${existing.name}`); return; }
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const newC: Customer = { id: Date.now().toString(), name: fullName, phone: newCustomerPhone, totalSpend: 0, visitCount: 0, lastVisit: new Date().toISOString() };
      await addCustomer(newC);
      setSelectedCustomer(newC); setFirstName(''); setLastName(''); setNewCustomerPhone(''); setCheckoutError(null);
  };

  const completeCheckout = async () => {
      if (isReturnMode && selectedCustomer) {
          for (const item of cart) {
              const bought = transactions.filter(t => t.customerId === selectedCustomer.id && t.type === 'sale').reduce((acc, t) => acc + (t.items.find(i => i.id === item.id)?.quantity || 0), 0);
              const returned = transactions.filter(t => t.customerId === selectedCustomer.id && t.type === 'return').reduce((acc, t) => acc + (t.items.find(i => i.id === item.id)?.quantity || 0), 0);
              if ((bought - returned) < item.quantity) { setCheckoutError(`${selectedCustomer.name} has only bought ${bought - returned} of ${item.name} available to return.`); return; }
          }
      }
      const subtotal = cart.reduce((acc, item) => acc + (item.sellPrice * item.quantity), 0);
      const totalDiscount = cart.reduce((acc, item) => acc + (item.discountAmount || 0), 0);
      const taxableAmount = subtotal - totalDiscount;
      const taxAmount = enableGst ? taxableAmount * 0.18 : 0; 
      const total = isReturnMode ? -(taxableAmount + taxAmount) : (taxableAmount + taxAmount);
      const tx: Transaction = {
          id: Date.now().toString(), items: [...cart], total,
          subtotal, discount: totalDiscount, tax: taxAmount,
          date: new Date().toISOString(), type: isReturnMode ? 'return' : 'sale',
          customerId: selectedCustomer?.id, customerName: selectedCustomer?.name
      };
      await processTransaction(tx);
      setIsCustomerModalOpen(false); setTransactionComplete(tx); setCart([]); setIsCartExpanded(false); setEnableGst(false);
      if(isReturnMode) setIsReturnMode(false);
  };

  const handlePrintReceipt = () => {
      if(!transactionComplete) return;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // -- HEADER --
      // CLEAN HEADER - NO LEFT TEXT
      // Logo / Store Name (Right Side Only)
      doc.setTextColor(180, 130, 60); 
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text(profile.storeName.toUpperCase(), pageWidth - 14, 20, { align: "right" } as any);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(profile.addressLine1 || "", pageWidth - 14, 26, { align: "right" } as any);
      doc.text(`${profile.addressLine2 || ""} ${profile.state || ""}`, pageWidth - 14, 30, { align: "right" } as any);
      
      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(139, 69, 19);
      doc.text("Tax Invoice", pageWidth / 2, 45, { align: "center" } as any);

      // -- BILL TO & INVOICE DETAILS --
      const startY = 55;
      doc.setTextColor(0);
      doc.setFontSize(9);
      
      doc.setFont("helvetica", "bold");
      doc.text("Bill To", 14, startY);
      doc.setFont("helvetica", "normal");
      const customerName = transactionComplete.customerName || "Walk-in Customer";
      const customerPhone = selectedCustomer?.phone || "";
      doc.text(customerName, 14, startY + 5);
      if(customerPhone) doc.text(`Contact No.: ${customerPhone}`, 14, startY + 10);

      doc.setFont("helvetica", "bold");
      doc.text("Invoice Details", pageWidth - 14, startY, { align: "right" } as any);
      doc.setFont("helvetica", "normal");
      doc.text(`Invoice No.: IN-${transactionComplete.id.slice(-6)}`, pageWidth - 14, startY + 5, { align: "right" } as any);
      doc.text(`Date: ${new Date(transactionComplete.date).toLocaleDateString('en-GB')}`, pageWidth - 14, startY + 10, { align: "right" } as any);
      if(enableGst && profile.gstin) doc.text(`GSTIN: ${profile.gstin}`, pageWidth - 14, startY + 15, { align: 'right' } as any);

      // -- TABLE --
      const tableBody = transactionComplete.items.map((item, index) => {
           const gross = item.sellPrice * item.quantity;
           const discountVal = item.discountAmount || 0;
           const discountPct = item.discountPercent || 0;
           const net = gross - discountVal;
           return [(index + 1).toString(), item.name, item.hsn || '', item.quantity.toString(), `Rs. ${item.sellPrice.toFixed(2)}`, discountVal > 0 ? `Rs. ${discountVal.toFixed(2)}\n(${discountPct.toFixed(1)}%)` : '-', `Rs. ${net.toFixed(2)}`];
      });

      const subTotal = transactionComplete.subtotal || transactionComplete.items.reduce((s, i) => s + (i.sellPrice * i.quantity), 0);
      const totalDiscount = transactionComplete.discount || 0;
      const tax = transactionComplete.tax || 0;
      const grandTotalExact = Math.abs(transactionComplete.total);
      const grandTotalRounded = Math.round(grandTotalExact);
      const roundOff = grandTotalRounded - grandTotalExact;
      
      const totalQty = transactionComplete.items.reduce((acc, i) => acc + i.quantity, 0);
      const totalRow = [
          { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold' as 'bold', halign: 'center' as 'center' } }, 
          { content: totalQty.toString(), styles: { fontStyle: 'bold' as 'bold', halign: 'center' as 'center' } }, 
          '', 
          `Rs. ${totalDiscount.toFixed(2)}`, 
          `Rs. ${grandTotalExact.toFixed(2)}`
      ];

      autoTable(doc, {
          startY: startY + 20,
          head: [['#', 'Item name', 'HSN/SAC', 'Quantity', 'Price/Unit', 'Discount', 'Amount']],
          body: [...tableBody, totalRow] as any,
          theme: 'plain',
          styles: { fontSize: 8, valign: 'middle', cellPadding: 3 },
          headStyles: { fillColor: [85, 45, 20], textColor: [255, 255, 255], fontStyle: 'bold' as 'bold', halign: 'center' as 'center' },
          columnStyles: { 0: { halign: 'center' as 'center', cellWidth: 10 }, 1: { halign: 'left' as 'left' }, 2: { halign: 'center' as 'center' }, 3: { halign: 'center' as 'center' }, 4: { halign: 'right' as 'right' }, 5: { halign: 'right' as 'right' }, 6: { halign: 'right' as 'right', fontStyle: 'bold' as 'bold' } },
          didParseCell: function(data) { if (data.row.index === tableBody.length) { (data.cell.styles as any).lineWidth = { top: 0.1, bottom: 0.1 }; (data.cell.styles as any).lineColor = 200; } }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 10;
      const summaryX = pageWidth - 80;
      doc.setFontSize(9);

      (doc as any).text("Sub Total", summaryX, finalY); (doc as any).text(`Rs. ${subTotal.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" }); finalY += 6;
      (doc as any).text("Discount", summaryX, finalY); (doc as any).text(`Rs. ${totalDiscount.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" }); finalY += 6;
      if(tax > 0) { (doc as any).text("GST (18%)", summaryX, finalY); (doc as any).text(`Rs. ${tax.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" }); finalY += 6; }
      (doc as any).text("Round off", summaryX, finalY); (doc as any).text(`Rs. ${roundOff.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" }); finalY += 8;
      doc.setFillColor(85, 45, 20); doc.rect(summaryX - 2, finalY - 5, 80, 8, 'F');
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); (doc as any).text("Total", summaryX, finalY); (doc as any).text(`Rs. ${grandTotalRounded.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" });
      
      doc.setTextColor(0); doc.setFont("helvetica", "normal"); (doc as any).text("Invoice Amount In Words", 14, finalY - 10);
      doc.setFont("helvetica", "bold"); (doc as any).text(`${grandTotalRounded} Rupees Only`, 14, finalY - 4); 

      // FOOTER LAYOUT
      const bottomY = pageHeight - 60; // Base position for footer elements
      
      // Left: Bank Details
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold"); 
      (doc as any).text("Pay To:", 14, bottomY); 
      doc.setFont("helvetica", "normal");
      const bankLines = [];
      if (profile.bankName) bankLines.push(`Bank Name: ${profile.bankName}`);
      if (profile.bankAccount) bankLines.push(`Bank Account No.: ${profile.bankAccount}`);
      if (profile.bankIfsc) bankLines.push(`Bank IFSC code: ${profile.bankIfsc}`);
      if (profile.bankHolder) bankLines.push(`Account Holder: ${profile.bankHolder}`);
      (doc as any).text(bankLines, 14, bottomY + 5);

      // Left (Below Bank): Terms and Conditions
      const termsY = bottomY + 30;
      doc.setFont("helvetica", "bold"); 
      (doc as any).text("Terms And Conditions", 14, termsY);
      doc.setFont("helvetica", "normal"); 
      (doc as any).text("Thanks for doing business with us!", 14, termsY + 5);

      // Right: Signature
      (doc as any).text(`For: ${profile.storeName}`, pageWidth - 50, bottomY, { align: "center" });
      if (profile.signatureImage) { try { doc.addImage(profile.signatureImage, 'PNG', pageWidth - 70, bottomY + 5, 40, 15); } catch(e) { doc.setFillColor(240); doc.rect(pageWidth - 70, bottomY + 5, 40, 15, 'F'); } } else { doc.setFillColor(240); doc.rect(pageWidth - 70, bottomY + 5, 40, 15, 'F'); }
      doc.setFontSize(8); (doc as any).text("Authorized Signatory", pageWidth - 50, bottomY + 25, { align: "center" });

      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.sellPrice * item.quantity), 0);
  const totalDiscount = cart.reduce((acc, item) => acc + (item.discountAmount || 0), 0);
  const taxable = subtotal - totalDiscount;
  const tax = enableGst ? taxable * 0.18 : 0;
  const grandTotal = isReturnMode ? -(taxable + tax) : (taxable + tax);
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()));
  const filteredCustomers = customerSearch ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)) : [];

  return (
    <div className={`h-full flex flex-col md:grid md:grid-cols-12 gap-4 pb-0 md:pb-0 transition-colors duration-500 ${isReturnMode ? 'bg-orange-50/30' : 'bg-background'}`}>
      <div className="flex flex-col gap-4 md:col-span-8 h-full overflow-hidden relative">
        <div className="shrink-0 flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border shadow-sm">
            <div className="flex p-1 bg-muted rounded-lg shrink-0">
                <button onClick={() => { setIsReturnMode(false); setCart([]); }} className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all ${!isReturnMode ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Sale</button>
                <button onClick={() => { setIsReturnMode(true); setCart([]); }} className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all ${isReturnMode ? 'bg-background shadow text-orange-600' : 'text-muted-foreground hover:text-foreground'}`}>Return</button>
            </div>
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input className="w-full bg-muted/50 hover:bg-muted focus:bg-background border-transparent focus:border-input rounded-lg pl-9 pr-4 py-2 text-sm outline-none border transition-all" placeholder="Search product name or SKU..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 shrink-0">
                <Button variant={isBulkMode ? "secondary" : "ghost"} size="icon" className={isBulkMode ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : ""} onClick={() => setIsBulkMode(!isBulkMode)} title="Bulk Mode"><Layers className="w-4 h-4" /></Button>
                <Button variant={isScanning ? "destructive" : "default"} onClick={() => setIsScanning(!isScanning)} className="hidden md:flex gap-2">
                    {isScanning ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}<span className="hidden lg:inline">{isScanning ? "Stop" : "Scan"}</span>
                </Button>
            </div>
        </div>

        {isScanning ? (
            <div className="flex-1 bg-black rounded-2xl overflow-hidden relative shadow-2xl border-4 border-black mb-24 md:mb-0">
                 <div id="reader" className="w-full h-full" />
                 <style>{` #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; } #reader__scan_region { display: none !important; } #reader__dashboard_section_csr { display: none !important; } #reader canvas { display: none !important; } #reader div[style*="border"] { border: none !important; box-shadow: none !important; } @keyframes scan { 0% { top: 2% } 50% { top: 98% } 100% { top: 2% } } .scan-line { animation: scan 3s ease-in-out infinite; } `}</style>
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-white/50 text-sm animate-pulse">Initializing Camera...</div></div>
                 {!scanMessage && (
                     <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                        <div className="relative w-72 h-72 border-2 border-white/30 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                             <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 -mt-1 -ml-1 rounded-tl-lg ${isReturnMode ? 'border-orange-500' : 'border-blue-500'}`}></div>
                             <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 -mt-1 -mr-1 rounded-tr-lg ${isReturnMode ? 'border-orange-500' : 'border-blue-500'}`}></div>
                             <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 -mb-1 -ml-1 rounded-bl-lg ${isReturnMode ? 'border-orange-500' : 'border-blue-500'}`}></div>
                             <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 -mb-1 -mr-1 rounded-br-lg ${isReturnMode ? 'border-orange-500' : 'border-blue-500'}`}></div>
                             <div className={`absolute left-2 right-2 h-0.5 shadow-[0_0_15px_3px] scan-line rounded-full ${isReturnMode ? 'bg-orange-500/80 shadow-orange-500/50' : 'bg-blue-500/80 shadow-blue-500/50'}`}></div>
                        </div>
                     </div>
                 )}
                 {scanMessage && (
                     <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="flex flex-col items-center animate-in zoom-in-50 duration-300">
                             {scanMessage.type === 'success' ? (<div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.6)] mb-6 animate-bounce"><CheckCircle className="w-12 h-12 text-white" /></div>) : (<div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.6)] mb-6 animate-pulse"><X className="w-12 h-12 text-white" /></div>)}
                             <h2 className="text-3xl font-bold text-white mb-2 text-center drop-shadow-md">{scanMessage.type === 'success' ? 'Success!' : 'Oops!'}</h2>
                             <p className="text-lg text-white/90 font-medium text-center max-w-[80%] drop-shadow-md">{scanMessage.text}</p>
                        </div>
                     </div>
                 )}
                 <div className="absolute top-4 right-4 z-20"><Button variant="secondary" size="icon" onClick={handleCloseScanner} className="bg-black/40 backdrop-blur-md text-white hover:bg-black/60 border-0 h-10 w-10 rounded-full"><X className="w-5 h-5" /></Button></div>
                 {!scanMessage && (<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full px-8"><Button variant="secondary" size="lg" onClick={handleCloseScanner} className="w-full bg-white/10 backdrop-blur-lg text-white hover:bg-white/20 border border-white/20 h-14 rounded-2xl shadow-lg"><Keyboard className="w-5 h-5 mr-3" /> Type SKU Manually</Button></div>)}
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-24 md:pb-4">
                    {filteredProducts.map(p => (<ProductGridItem key={p.id} product={p} isReturnMode={isReturnMode} onAdd={(qty) => handleProductSelect(String(p.id), false, qty)} />))}
                    {filteredProducts.length === 0 && <div className="col-span-full py-20 text-center text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No products found.</p></div>}
                </div>
            </div>
        )}
        <Button size="icon" className={`absolute bottom-32 right-4 h-14 w-14 rounded-full shadow-xl z-30 md:hidden transition-transform active:scale-95 ${isScanning ? 'bg-destructive' : 'bg-primary'}`} onClick={() => setIsScanning(!isScanning)}>{isScanning ? <X className="w-6 h-6" /> : <Scan className="w-6 h-6" />}</Button>
      </div>

      <div className={`md:col-span-4 flex flex-col h-full transition-all duration-300 z-40 ${isCartExpanded ? 'fixed inset-0 bg-background' : 'fixed bottom-16 left-0 right-0 h-16 md:static md:h-auto md:bg-transparent'}`}>
          <div className={`flex flex-col h-full bg-card md:rounded-xl md:border shadow-xl md:shadow-sm overflow-hidden ${isReturnMode ? 'border-orange-200' : 'border-border'}`}>
              <div className={`p-4 flex items-center justify-between cursor-pointer md:cursor-default ${isReturnMode ? 'bg-orange-50' : 'bg-muted/30'}`} onClick={() => window.innerWidth < 768 && setIsCartExpanded(!isCartExpanded)}>
                  <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isReturnMode ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{isReturnMode ? <RotateCcw className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}</div>
                      <div><h2 className={`font-bold text-sm ${isReturnMode ? 'text-orange-900' : 'text-foreground'}`}>{isReturnMode ? 'Return Bill' : 'Current Sale'}</h2><p className="text-[10px] text-muted-foreground">{cart.length} items</p></div>
                  </div>
                  <div className="md:hidden">{isCartExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}</div>
              </div>
              <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${!isCartExpanded ? 'hidden md:block' : 'block'}`}>
                  {cart.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 space-y-2"><ShoppingCart className="w-12 h-12" /><p className="text-sm font-medium">Cart is empty</p></div>) : (cart.map(item => (
                      <div key={item.id} className="group flex flex-col gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-white rounded-md border flex items-center justify-center shrink-0 overflow-hidden">{item.image ? <img src={item.image} className="h-full w-full object-cover" /> : <span className="text-[8px] text-muted-foreground">IMG</span>}</div>
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start"><h4 className="text-xs font-semibold truncate pr-2">{item.name}</h4><span className="text-xs font-bold whitespace-nowrap">₹{(item.sellPrice * item.quantity).toFixed(2)}</span></div>
                                  <div className="flex justify-between items-center mt-1">
                                      <p className="text-[10px] text-muted-foreground font-mono">{item.sku}</p>
                                      <div className="flex items-center bg-background border rounded-md h-6 shadow-sm">
                                          <button className="px-1.5 hover:bg-muted h-full text-muted-foreground hover:text-destructive" onClick={() => updateQuantity(String(item.id), -1)}><Minus className="w-3 h-3" /></button>
                                          <span className="px-1.5 text-[10px] font-semibold min-w-[1.2rem] text-center border-x bg-muted/20 h-full flex items-center">{item.quantity}</span>
                                          <button className="px-1.5 hover:bg-muted h-full text-muted-foreground hover:text-primary" onClick={() => updateQuantity(String(item.id), 1)}><Plus className="w-3 h-3" /></button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-2 pl-[3.25rem] flex-wrap">
                              <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                              <div className="flex items-center gap-1">
                                  {[5, 10, 15].map((pct) => (<button key={pct} className={`text-[9px] px-1.5 py-0.5 rounded border ${item.discountPercent === pct ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:bg-muted'}`} onClick={() => updateDiscount(String(item.id), pct, 'percent')}>{pct}%</button>))}
                              </div>
                              <div className="flex items-center gap-1 ml-1 bg-background border rounded px-1"><span className="text-[9px] text-muted-foreground">₹</span><input type="number" className="w-8 text-[9px] bg-transparent outline-none p-0.5" placeholder="0" value={item.discountAmount || ''} onChange={(e) => updateDiscount(String(item.id), e.target.value, 'amount')} /></div>
                          </div>
                      </div>
                  )))}
              </div>
              <div className={`p-4 border-t bg-card space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] ${!isCartExpanded ? 'hidden md:block' : 'block'}`}>
                  {cartError && <div className="bg-destructive/10 text-destructive text-xs p-2 rounded flex items-center gap-2 animate-in slide-in-from-bottom-2"><AlertCircle className="w-3 h-3" /> {cartError}</div>}
                  <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                      {totalDiscount > 0 && <div className="flex justify-between text-xs text-green-600"><span>Discount</span><span>-₹{totalDiscount.toFixed(2)}</span></div>}
                      <div className="flex justify-between items-center py-1"><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">GST (18%)</span><Switch checked={enableGst} onCheckedChange={setEnableGst} className="scale-75 origin-left" /></div>{enableGst && <span className="text-xs">₹{Math.abs(tax).toFixed(2)}</span>}</div>
                      <div className="flex justify-between items-center pt-2 border-t"><span className="text-sm font-semibold">Total Amount</span><span className={`text-xl font-bold ${isReturnMode ? 'text-orange-600' : 'text-primary'}`}>{isReturnMode ? '-' : ''}₹{Math.abs(grandTotal).toFixed(2)}</span></div>
                  </div>
                  <Button className={`w-full h-11 text-base font-bold shadow-lg transition-transform active:scale-95 ${isReturnMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-primary hover:bg-primary/90'}`} onClick={initiateCheckout} disabled={cart.length === 0}>{isReturnMode ? 'Refund Customer' : 'Proceed to Pay'}</Button>
              </div>
          </div>
      </div>

      {bulkModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
              <Card className="w-full max-w-xs animate-in zoom-in-95 duration-200 shadow-2xl">
                  <CardHeader className="pb-2"><CardTitle className="text-center text-lg">{bulkModal.product?.name}</CardTitle><p className="text-center text-xs text-muted-foreground">Select Quantity</p></CardHeader>
                  <CardContent className="space-y-6 pt-2">
                      <div className="flex items-center justify-center gap-4"><Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setBulkQty(Math.max(1, bulkQty - 1))}><Minus className="w-5 h-5" /></Button><div className="text-4xl font-bold w-20 text-center">{bulkQty}</div><Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setBulkQty(bulkQty + 1)}><Plus className="w-5 h-5" /></Button></div>
                      <div className="flex justify-center gap-2">{[5, 10, 20, 50].map(n => (<Button key={n.toString()} variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setBulkQty(n)}>+{n}</Button>))}</div>
                      <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setBulkModal({isOpen:false, product:null})}>Cancel</Button><Button onClick={() => { if(bulkModal.product) handleProductSelect(String(bulkModal.product.id), false, bulkQty as any); setBulkModal({isOpen:false, product:null}); }}>Add</Button></div>
                  </CardContent>
              </Card>
          </div>
      )}

      {isCustomerModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
              <Card className="w-full max-w-md animate-in slide-in-from-bottom-10 duration-300 shadow-2xl max-h-[90vh] flex flex-col">
                  <CardHeader className="border-b bg-muted/20 pb-4"><div className="flex justify-between items-center"><CardTitle>Checkout Details</CardTitle><Button variant="ghost" size="icon" onClick={() => setIsCustomerModalOpen(false)}><X className="w-4 h-4" /></Button></div></CardHeader>
                  <CardContent className="space-y-5 p-6 overflow-y-auto">
                      {checkoutError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {checkoutError}</div>}
                      <div className="space-y-3">
                          <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Select Customer</Label>
                          <div className="relative">
                              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="Search Name or Phone..." className="pl-9 bg-muted/30" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                              {customerSearch && (<div className="absolute top-full left-0 right-0 mt-1 bg-popover border shadow-lg rounded-md z-10 max-h-40 overflow-y-auto divide-y">{filteredCustomers.length > 0 ? filteredCustomers.map(c => (<div key={c.id} className="p-3 hover:bg-accent cursor-pointer flex justify-between items-center" onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}><div><p className="font-medium text-sm">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone}</p></div></div>)) : <div className="p-3 text-xs text-center text-muted-foreground">No matches found</div>}</div>)}
                          </div>
                      </div>
                      {selectedCustomer ? (
                          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center gap-3 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-1.5 bg-primary rounded-bl-xl"><CheckCircle className="w-4 h-4 text-primary-foreground" /></div>
                              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">{selectedCustomer.name.charAt(0)}</div>
                              <div><p className="font-bold text-sm">{selectedCustomer.name}</p><p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p></div>
                              <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setSelectedCustomer(null)}>Change</Button>
                          </div>
                      ) : (
                          <div className="space-y-3 pt-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px bg-border flex-1" /> OR NEW CUSTOMER <span className="h-px bg-border flex-1" /></div>
                              <div className="grid grid-cols-2 gap-3"><Input placeholder="First Name" value={firstName} onChange={e => { setFirstName(e.target.value); setCheckoutError(null); }} /><Input placeholder="Last Name" value={lastName} onChange={e => { setLastName(e.target.value); setCheckoutError(null); }} /></div>
                              <div className="space-y-1"><Input placeholder="Phone Number (10 digits)" type="number" value={newCustomerPhone} onChange={e => { setNewCustomerPhone(e.target.value); setCheckoutError(null); }} /><p className="text-[10px] text-muted-foreground pl-1">Must be 10 digits</p></div>
                              <Button variant="outline" className="w-full" onClick={createCustomer}>Create Profile</Button>
                          </div>
                      )}
                      <Button className="w-full h-12 text-lg font-bold" onClick={completeCheckout}>{selectedCustomer ? 'Confirm & Pay' : (isReturnMode ? 'Customer Required' : 'Skip & Pay (Guest)')}</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {transactionComplete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70]">
              <Card className="w-full max-w-sm animate-in zoom-in-95 duration-300 shadow-2xl">
                  <CardHeader className="bg-green-50 border-b pb-4 text-center relative">
                      <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2"><CheckCircle className="w-6 h-6" /></div>
                      <CardTitle className="text-green-800">Payment Successful</CardTitle>
                      <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => setTransactionComplete(null)}><X className="w-4 h-4" /></Button>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                      <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-muted-foreground/30 text-center space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Paid</p>
                          <p className="text-3xl font-bold text-foreground">₹{Math.abs(transactionComplete.total).toFixed(2)}</p>
                          <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-2"><span>Order #{transactionComplete.id.slice(-6)}</span>{transactionComplete.discount ? <span className="text-green-600">Savings: ₹{transactionComplete.discount.toFixed(2)}</span> : null}{transactionComplete.tax ? <span>GST: ₹{transactionComplete.tax.toFixed(2)}</span> : null}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3"><Button variant="outline" className="w-full" onClick={handlePrintReceipt}><Share2 className="w-4 h-4 mr-2" /> Share PDF</Button><Button className="w-full" onClick={handlePrintReceipt}><Printer className="w-4 h-4 mr-2" /> Print</Button></div>
                  </CardContent>
              </Card>
          </div>
      )}
    </div>
  );
}
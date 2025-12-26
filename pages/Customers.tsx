
import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, Transaction } from '../types';
import { loadData, processTransaction, deleteCustomer, addCustomer } from '../services/storage';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Select, Input, Label } from '../components/ui';
import { Users, Phone, Calendar, ArrowRight, History, X, Eye, IndianRupee, FileText, Download, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown, PhoneCall, ChevronRight, Wallet, CreditCard, Coins, CheckCircle, AlertCircle, Trash2, Plus, UserPlus, Package, Trophy, Star, Activity, Award, Gem, UserCheck, TrendingUp, ShoppingBag } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Modal States
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Online'>('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all_time');
  const [sortBy, setSortBy] = useState<'spend' | 'due' | 'lastVisit'>('spend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const refreshData = () => {
    const data = loadData();
    setCustomers(data.customers);
    setTransactions(data.transactions);
    
    if (viewingCustomer) {
        const updatedC = data.customers.find(c => c.id === viewingCustomer.id);
        if (updatedC) setViewingCustomer(updatedC);
        else setViewingCustomer(null);
    }
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('storage', refreshData);
    window.addEventListener('local-storage-update', refreshData);
    return () => {
        window.removeEventListener('storage', refreshData);
        window.removeEventListener('local-storage-update', refreshData);
    };
  }, []);

  // Calculate High Value Threshold (Top 10% of total database)
  const highValueThreshold = useMemo(() => {
    if (customers.length < 3) return Infinity;
    const sorted = [...customers].sort((a, b) => b.totalSpend - a.totalSpend);
    const index = Math.max(0, Math.floor(customers.length * 0.1));
    return sorted[index].totalSpend;
  }, [customers]);

  const filteredData = useMemo(() => {
    let processed = [...customers];
    
    // Initial filtering
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        processed = processed.filter(c => 
            c.name.toLowerCase().includes(lowerQ) || 
            c.phone.includes(lowerQ)
        );
    }
    
    if (filterType === 'has_due') {
        processed = processed.filter(c => c.totalDue > 0);
    }
    
    // Sorting
    processed.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'spend') { valA = a.totalSpend; valB = b.totalSpend; }
        else if (sortBy === 'due') { valA = a.totalDue; valB = b.totalDue; }
        else { valA = new Date(a.lastVisit).getTime(); valB = new Date(b.lastVisit).getTime(); }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const totalDues = processed.reduce((acc, c) => acc + (c.totalDue || 0), 0);
    
    // Show all matching customers
    const displayCustomers = processed;

    return { displayCustomers, totalDues, totalCount: processed.length };
  }, [customers, searchQuery, filterType, sortBy, sortOrder]);

  const customerHistory = useMemo(() => {
      if (!viewingCustomer) return [];
      return transactions
        .filter(t => t.customerId === viewingCustomer.id)
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, viewingCustomer]);

  const handleRecordPayment = () => {
      if (!viewingCustomer || !paymentAmount) return;
      const amount = parseFloat(paymentAmount);
      if (amount <= 0) return;
      const tx: Transaction = {
          id: Date.now().toString(),
          items: [],
          total: amount,
          date: new Date().toISOString(),
          type: 'payment',
          customerId: viewingCustomer.id,
          customerName: viewingCustomer.name,
          paymentMethod: paymentMethod,
          notes: paymentNote
      };
      processTransaction(tx);
      refreshData();
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNote('');
  };

  const handleAddCustomerSubmit = () => {
      if (!newCustomer.name || !newCustomer.phone) return;
      const customer: Customer = {
          id: Date.now().toString(),
          name: newCustomer.name,
          phone: newCustomer.phone,
          totalSpend: 0,
          totalDue: 0,
          visitCount: 0,
          lastVisit: new Date().toISOString()
      };
      addCustomer(customer);
      refreshData();
      setIsAddModalOpen(false);
      setNewCustomer({ name: '', phone: '' });
  };

  const handleDeleteCustomer = () => {
      if (!viewingCustomer) return;
      if (deleteConfirmName.trim() === viewingCustomer.name) {
          deleteCustomer(viewingCustomer.id);
          refreshData();
          setIsDeleteModalOpen(false);
          setDeleteConfirmName('');
          setViewingCustomer(null);
      }
  };

  const generateStatementPDF = () => {
      if (!viewingCustomer) return;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 45, 'F');
      doc.setFontSize(20); doc.setTextColor(255, 255, 255); doc.text("Customer Ledger Statement", 14, 20);
      doc.setFontSize(10); doc.setTextColor(200, 200, 200); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
      doc.text(viewingCustomer.name, pageWidth - 14, 20, { align: 'right' });
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(viewingCustomer.phone, pageWidth - 14, 28, { align: 'right' });
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 55, pageWidth - 28, 25, 2, 2, 'F');
      doc.setTextColor(71, 85, 105); doc.setFontSize(10); doc.text("Total Outstanding Due", pageWidth/2, 63, { align: 'center' });
      doc.setTextColor(220, 38, 38); doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(`Rs. ${viewingCustomer.totalDue.toFixed(2)}`, pageWidth/2, 72, { align: 'center' });

      let tableBody: any[] = customerHistory.map(tx => {
          let description = '', credit = '', debit = '', typeStr = '';
          if (tx.type === 'sale') {
              typeStr = `Sale (${tx.items.length} items)`;
              description = tx.paymentMethod === 'Credit' ? 'Credit Purchase' : 'Paid Purchase';
              debit = tx.total.toFixed(2);
          } else if (tx.type === 'return') {
              typeStr = 'Return'; description = 'Items Returned'; credit = Math.abs(tx.total).toFixed(2);
          } else if (tx.type === 'payment') {
              typeStr = 'Payment In'; description = tx.notes || 'Payment Received'; credit = tx.total.toFixed(2);
          }
          return [new Date(tx.date).toLocaleDateString(), typeStr, description, tx.paymentMethod || '-', debit ? `Rs.${debit}` : '-', credit ? `Rs.${credit}` : '-'];
      });

      autoTable(doc, {
          startY: 90, head: [['Date', 'Type', 'Description', 'Method', 'Debit', 'Credit']], body: tableBody, theme: 'grid', styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [51, 65, 85], textColor: 255 },
          columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right', textColor: [22, 163, 74] } },
      });
      doc.save(`${viewingCustomer.name}_Ledger.pdf`);
  };

  const generateAllCustomersPDF = () => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(20); doc.setTextColor(255, 255, 255); doc.text("Customer Dues Report", 14, 20);
      doc.setFontSize(10); doc.setTextColor(203, 213, 225); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
      const tableBody = filteredData.displayCustomers.map(c => [c.name, c.phone, `Rs.${c.totalSpend.toFixed(0)}`, `Rs.${c.totalDue.toFixed(2)}`]);
      tableBody.push(['TOTAL', '', '', `Rs.${filteredData.totalDues.toFixed(2)}`]);
      autoTable(doc, { startY: 50, head: [['Name', 'Phone', 'Total Spend', 'Current Due']], body: tableBody, theme: 'striped', columnStyles: { 3: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } } });
      doc.save(`Customer_Dues_Report.pdf`);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0 relative">
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-md border-b shadow-sm space-y-3">
          <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl md:text-3xl font-bold tracking-tight flex items-center gap-2 text-slate-900">
                    Customers
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block font-medium">Database of clients filtered by purchase volume and credit health.</p>
              </div>
              <div className="flex gap-2">
                  <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="h-8 md:h-9 bg-primary shadow-sm">
                      <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Add Customer</span>
                  </Button>
                  <Button onClick={generateAllCustomersPDF} variant="outline" size="sm" className="h-8 md:h-9 shadow-sm">
                      <FileText className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Dues Report</span>
                  </Button>
              </div>
          </div>
          
          {filteredData.totalDues > 0 && (
             <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-red-700">
                     <AlertCircle className="w-5 h-5" />
                     <span className="text-xs font-bold uppercase tracking-wider">Total Outstanding Dues</span>
                 </div>
                 <span className="text-lg font-bold text-red-800">₹{filteredData.totalDues.toLocaleString()}</span>
             </div>
          )}

          <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name or phone..." className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center bg-white rounded-xl px-2 border border-slate-200 shrink-0 shadow-sm">
               <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="h-full text-xs border-0 bg-transparent w-24 font-bold text-slate-700">
                   <option value="spend">Sort: Spend</option>
                   <option value="due">Sort: Due</option>
                   <option value="lastVisit">Sort: Recent</option>
               </Select>
               <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                   {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
               </Button>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {filteredData.displayCustomers.map((customer, idx) => {
              const isHighValue = customer.totalSpend >= highValueThreshold && customer.totalSpend > 0;
              const hasDue = customer.totalDue > 0;
              const lastActive = new Date(customer.lastVisit);
              const isInactive = (new Date().getTime() - lastActive.getTime()) > (30 * 24 * 60 * 60 * 1000);
              
              return (
                <Card 
                    key={customer.id} 
                    className={`cursor-pointer group aspect-square flex flex-col hover:shadow-xl transition-all duration-300 relative border overflow-hidden ${isHighValue ? 'border-slate-800 bg-slate-50/10 ring-1 ring-slate-200/50 shadow-md' : 'border-slate-200 bg-white'}`}
                    onClick={() => setViewingCustomer(customer)}
                >
                    {/* High Value Badge - Clean, Professional Look */}
                    {isHighValue && (
                        <div className="absolute top-0 right-0 p-1.5 z-10">
                            <Badge className="bg-slate-800 text-white border-0 shadow-md text-[8px] h-4 sm:h-5 sm:text-[9px] font-bold uppercase tracking-tight">
                                <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3 sm:mr-1 mr-0.5 text-amber-400" /> High Value
                            </Badge>
                        </div>
                    )}

                    <CardContent className="p-2.5 sm:p-4 flex flex-col h-full justify-between items-center text-center">
                        {/* Avatar & Name */}
                        <div className="flex flex-col items-center w-full">
                            <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-sm sm:text-2xl font-black text-white shadow-md transition-transform group-hover:scale-105 ${isHighValue ? 'bg-gradient-to-br from-slate-700 to-slate-900 ring-2 ring-slate-100' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
                                {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="mt-2 sm:mt-3">
                                <h3 className={`font-extrabold text-[11px] sm:text-sm line-clamp-1 leading-tight ${isHighValue ? 'text-slate-900' : 'text-slate-700'}`}>{customer.name}</h3>
                                <p className="text-[10px] sm:text-xs text-slate-500 font-medium flex items-center justify-center gap-1 mt-1">
                                    <Phone className="w-2.5 h-2.5" /> {customer.phone}
                                </p>
                            </div>
                        </div>

                        {/* Mid Stats - Professional balanced grid showing visits beside purchases */}
                        <div className="w-full grid grid-cols-2 gap-0.5 py-1.5 sm:py-2.5 border-y border-slate-100 mt-1.5 sm:mt-3">
                            <div className="flex flex-col items-center">
                                <span className="text-[7px] sm:text-[9px] uppercase font-bold text-slate-400 leading-none mb-0.5">Purchases</span>
                                <span className={`text-[10px] sm:text-xs font-black ${isHighValue ? 'text-slate-900' : 'text-slate-800'}`}>₹{customer.totalSpend.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col items-center border-l border-slate-100">
                                <span className="text-[7px] sm:text-[9px] uppercase font-bold text-slate-400 leading-none mb-0.5">Visits</span>
                                <span className="text-[10px] sm:text-xs font-black text-slate-700">{customer.visitCount || 0}</span>
                            </div>
                        </div>

                        {/* Footer Status - Strictly packed */}
                        <div className="w-full pt-1.5 flex flex-col gap-1.5">
                            {hasDue ? (
                                <Badge variant="destructive" className="w-full justify-center py-0.5 h-4 sm:h-5 text-[8px] sm:text-[10px] font-bold rounded-sm shadow-sm">
                                    DUE: ₹{customer.totalDue.toFixed(0)}
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="w-full justify-center py-0.5 h-4 sm:h-5 text-[8px] sm:text-[10px] text-emerald-700 bg-emerald-50 border-emerald-100 rounded-sm font-bold">
                                    PAID ACCOUNT
                                </Badge>
                            )}
                            
                            <div className="flex items-center justify-between text-[7px] sm:text-[9px] text-slate-400 px-0.5 font-medium">
                                <span className="flex items-center gap-1">
                                    <Activity className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${isInactive ? 'text-slate-200' : 'text-emerald-500'}`} />
                                    {isInactive ? 'Inactive' : 'Active'}
                                </span>
                                <span>{new Date(customer.lastVisit).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
              );
          })}
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <Card className="w-full max-w-sm shadow-2xl animate-in zoom-in">
                  <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
                      <CardTitle className="text-lg">Add New Customer</CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)}><X className="w-4 h-4" /></Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                      <div className="space-y-2"><Label>Full Name</Label><Input placeholder="John Doe" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Phone Number</Label><Input placeholder="9876543210" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} /></div>
                      <Button className="w-full h-11" onClick={handleAddCustomerSubmit}>Create Customer</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* Detail Modal */}
      {viewingCustomer && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
              <Card className="w-full h-[95vh] sm:h-[85vh] sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden">
                  <CardHeader className="border-b pb-4">
                      <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-slate-800 text-white flex items-center justify-center text-xl font-bold shadow-lg">
                                    {viewingCustomer.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        {viewingCustomer.name}
                                        {viewingCustomer.totalSpend >= highValueThreshold && <Badge className="bg-amber-100 text-amber-800 border-amber-200">High Value</Badge>}
                                    </CardTitle>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1"><Phone className="w-3 h-3" /> {viewingCustomer.phone}</div>
                                </div>
                          </div>
                          <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setIsDeleteModalOpen(true)}><Trash2 className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingCustomer(null)}><X className="w-4 h-4" /></Button>
                          </div>
                      </div>
                      <div className="flex gap-3 mt-5">
                           <div className={`flex-1 p-3 rounded-lg border flex flex-col ${viewingCustomer.totalDue > 0 ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-emerald-50 border-emerald-200 shadow-sm'}`}>
                               <div className={`text-[10px] uppercase font-black ${viewingCustomer.totalDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Balance Ledger</div>
                               <div className={`text-2xl font-black ${viewingCustomer.totalDue > 0 ? 'text-red-700' : 'text-emerald-700'}`}>₹{viewingCustomer.totalDue.toFixed(2)}</div>
                           </div>
                           <div className="flex flex-col gap-2">
                               <Button size="sm" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm" disabled={viewingCustomer.totalDue <= 0} onClick={() => setIsPaymentModalOpen(true)}><Coins className="w-4 h-4 mr-1.5" /> Record Payment</Button>
                               <Button size="sm" variant="outline" className="flex-1 text-xs font-bold" onClick={generateStatementPDF}><FileText className="w-4 h-4 mr-1.5" /> Statement</Button>
                           </div>
                      </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-0 bg-background">
                      <div className="bg-slate-50 p-2.5 text-[10px] uppercase font-black px-4 text-slate-500 border-b tracking-widest flex justify-between">
                          <span>Recent Activity</span>
                          <span className="flex items-center gap-1"><History className="w-3 h-3" /> Ledger History</span>
                      </div>
                      {customerHistory.length === 0 ? <div className="p-10 text-center text-muted-foreground italic">No transactions recorded for this client.</div> : (
                          <div className="divide-y divide-slate-100">{customerHistory.map(tx => (
                              <div key={tx.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group" onClick={() => tx.type !== 'payment' && setSelectedTx(tx)}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.type === 'payment' ? 'bg-emerald-100 text-emerald-700' : (tx.paymentMethod === 'Credit' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700')}`}>
                                          {tx.type === 'payment' ? <Wallet className="w-4 h-4" /> : (tx.paymentMethod === 'Credit' ? <AlertCircle className="w-4 h-4" /> : <Package className="w-4 h-4" />)}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">#{tx.id.slice(-6)}</span>
                                              <Badge variant={tx.type === 'payment' ? 'success' : (tx.paymentMethod === 'Credit' ? 'destructive' : 'secondary')} className="h-4 px-1 text-[9px] font-bold">
                                                  {tx.type.toUpperCase()}
                                              </Badge>
                                          </div>
                                          <div className="text-xs font-bold mt-1 text-slate-700">{new Date(tx.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {tx.notes && <span className="font-normal text-muted-foreground ml-1">- {tx.notes}</span>}</div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <div className={`text-sm sm:text-base font-black ${tx.type === 'payment' ? 'text-emerald-700' : (tx.paymentMethod === 'Credit' ? 'text-red-700' : 'text-slate-900')}`}>
                                          {tx.type === 'payment' ? '-' : ''}₹{Math.abs(tx.total).toFixed(2)}
                                      </div>
                                      {tx.type !== 'payment' && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />}
                                  </div>
                              </div>
                          ))}</div>
                      )}
                  </CardContent>
              </Card>
          </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && viewingCustomer && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <Card className="w-full max-w-xs shadow-2xl animate-in zoom-in border-t-4 border-t-emerald-600">
                  <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Coins className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-lg">Record Client Payment</CardTitle>
                      <p className="text-xs text-muted-foreground">Reducing debt for {viewingCustomer.name}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase text-slate-500">Amount Received</Label><div className="relative"><span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span><Input type="number" className="pl-8 text-xl font-black text-emerald-700" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} autoFocus /></div></div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase text-slate-500">Payment Channel</Label><div className="grid grid-cols-2 gap-2"><Button size="sm" variant={paymentMethod === 'Cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('Cash')}>Cash</Button><Button size="sm" variant={paymentMethod === 'Online' ? 'default' : 'outline'} onClick={() => setPaymentMethod('Online')}>Digital</Button></div></div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase text-slate-500">Reference / Notes</Label><Input placeholder="Internal memo" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} /></div>
                      <div className="flex gap-2 pt-2"><Button variant="ghost" className="flex-1 font-bold text-xs" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button><Button className="flex-1 bg-emerald-700 font-bold text-xs" onClick={handleRecordPayment}>Save Ledger</Button></div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && viewingCustomer && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <Card className="w-full max-w-sm border-t-4 border-t-destructive shadow-2xl animate-in zoom-in">
                  <CardHeader><CardTitle className="text-destructive flex items-center gap-2"><Trash2 className="w-5 h-5" /> Delete Account?</CardTitle></CardHeader>
                  <CardContent className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">This action is irreversible. All transaction history for this client will remain in the database but the profile will be removed. Type <strong>{viewingCustomer.name}</strong> to confirm.</p>
                      <Input value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} placeholder="Type name here" className="text-center font-bold" />
                      <div className="flex gap-2 pt-2"><Button variant="ghost" className="flex-1 font-bold" onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmName(''); }}>Cancel</Button>
                      <Button className="flex-1 bg-destructive font-bold" disabled={deleteConfirmName !== viewingCustomer.name} onClick={handleDeleteCustomer}>Confirm Deletion</Button></div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* Transaction View */}
      {selectedTx && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
              <Card className="w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in">
                  <CardHeader className="border-b bg-slate-50/50"><div className="flex justify-between items-center"><CardTitle className="text-lg">Order Review #{selectedTx.id.slice(-6)}</CardTitle><Button variant="ghost" size="icon" onClick={() => setSelectedTx(null)}><X className="w-4 h-4" /></Button></div></CardHeader>
                  <CardContent className="overflow-y-auto p-4 space-y-4">
                      {selectedTx.items.map((item, i) => (
                          <div key={i} className="flex gap-3 items-center border-b border-slate-100 pb-3 last:border-0">
                              <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 border">{item.image ? <img src={item.image} className="w-full h-full object-cover rounded-lg" /> : <Package className="w-5 h-5 opacity-20" />}</div>
                              <div className="flex-1"><p className="text-sm font-black text-slate-800 leading-tight">{item.name}</p><p className="text-[10px] font-bold text-muted-foreground mt-0.5">Quantity: {item.quantity} units @ ₹{item.sellPrice}</p></div>
                              <div className="text-sm font-black text-slate-900">₹{((item.sellPrice * item.quantity) - (item.discountAmount || 0)).toFixed(2)}</div>
                          </div>
                      ))}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm space-y-2">
                          <div className="flex justify-between text-slate-500 font-bold"><span>Subtotal</span><span>₹{selectedTx.subtotal?.toFixed(2)}</span></div>
                          {selectedTx.discount && selectedTx.discount > 0 && <div className="flex justify-between text-emerald-600 font-bold"><span>Discount Applied</span><span>-₹{selectedTx.discount.toFixed(2)}</span></div>}
                          <div className="flex justify-between font-black text-lg pt-2 border-t border-slate-200 text-slate-900"><span>Grand Total</span><span>₹{Math.abs(selectedTx.total).toFixed(2)}</span></div>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}
    </div>
  );
}

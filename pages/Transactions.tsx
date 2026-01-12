
import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from '../types';
import { loadData } from '../services/storage';
import { Card, CardContent, CardHeader, CardTitle, Badge, Select, Input, Button } from '../components/ui';
import { TrendingUp, TrendingDown, IndianRupee, Calendar, X, Eye, ArrowUpRight, ArrowDownLeft, User, Package, Clock, Download, CreditCard } from 'lucide-react';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    const refreshData = () => {
      const data = loadData();
      setTransactions(data.transactions);
    };

    refreshData();
    window.addEventListener('storage', refreshData);
    window.addEventListener('local-storage-update', refreshData);
    return () => {
        window.removeEventListener('storage', refreshData);
        window.removeEventListener('local-storage-update', refreshData);
    };
  }, []);

  const filteredTransactions = useMemo(() => {
      const now = new Date();
      now.setHours(0,0,0,0); // Start of today

      return transactions.filter(tx => {
          const txDate = new Date(tx.date);
          txDate.setHours(0,0,0,0);
          
          switch(filterType) {
              case 'today':
                  return txDate.getTime() === now.getTime();
              case 'yesterday':
                  const yest = new Date(now);
                  yest.setDate(yest.getDate() - 1);
                  return txDate.getTime() === yest.getTime();
              case '7days':
                  const week = new Date(now);
                  week.setDate(week.getDate() - 7);
                  return txDate >= week;
              case '15days':
                  const days15 = new Date(now);
                  days15.setDate(days15.getDate() - 15);
                  return txDate >= days15;
              case '30days':
                  const days30 = new Date(now);
                  days30.setDate(days30.getDate() - 30);
                  return txDate >= days30;
              case '6months':
                  const months6 = new Date(now);
                  months6.setMonth(months6.getMonth() - 6);
                  return txDate >= months6;
              case '1year':
                  const year1 = new Date(now);
                  year1.setFullYear(year1.getFullYear() - 1);
                  return txDate >= year1;
              case 'custom':
                  if (!customStart) return true;
                  const start = new Date(customStart);
                  start.setHours(0,0,0,0);
                  if (txDate < start) return false;
                  
                  if (customEnd) {
                      const end = new Date(customEnd);
                      end.setHours(23,59,59,999);
                      if (txDate > end) return false;
                  }
                  return true;
              default:
                  return true;
          }
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, customStart, customEnd]);

  const stats = useMemo(() => {
      let totalRevenue = 0;
      let totalReturns = 0;
      let grossProfit = 0;

      filteredTransactions.forEach(tx => {
          const amount = Math.abs(tx.total);
          
          if (tx.type === 'sale') {
              totalRevenue += amount;
              // Calculate Profit: (Sell - Buy) * Qty
              tx.items.forEach(item => {
                  const profit = (item.sellPrice - item.buyPrice) * item.quantity;
                  grossProfit += profit;
              });
          } else {
              totalReturns += amount;
              // Reverse Profit for returns
              tx.items.forEach(item => {
                  const profit = (item.sellPrice - item.buyPrice) * item.quantity;
                  grossProfit -= profit;
              });
          }
      });

      return {
          totalRevenue,
          totalReturns,
          netSales: totalRevenue - totalReturns,
          grossProfit
      };
  }, [filteredTransactions]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(30, 41, 59); // Dark blue/slate
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("Transaction Report", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Filter: ${filterType.toUpperCase()}`, pageWidth - 14, 30, { align: 'right' });

    // Executive Summary Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 45, pageWidth - 28, 25, 2, 2, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Total Revenue", 20, 54);
    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74); // Green
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${stats.totalRevenue.toLocaleString()}`, 20, 62);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Returns", 70, 54);
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38); // Red
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${stats.totalReturns.toLocaleString()}`, 70, 62);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Net Profit", 120, 54);
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Dark
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${stats.grossProfit.toLocaleString()}`, 120, 62);

    // Table
    const tableBody = filteredTransactions.map(tx => [
        new Date(tx.date).toLocaleDateString(),
        tx.id.slice(-6),
        tx.type.toUpperCase(),
        tx.customerName || 'Walk-in',
        tx.paymentMethod || '-',
        `Rs. ${Math.abs(tx.total).toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 75,
        head: [['Date', 'ID', 'Type', 'Customer', 'Method', 'Amount']],
        body: tableBody,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 
            5: { halign: 'right', fontStyle: 'bold' } 
        },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 2) {
                if (data.cell.raw === 'SALE') data.cell.styles.textColor = [22, 163, 74];
                else data.cell.styles.textColor = [220, 38, 38];
            }
        }
    });

    doc.save(`transactions_${filterType}_report.pdf`);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">Financial overview and history.</p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-2 rounded-lg border w-full md:w-auto">
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-[140px] h-9 text-sm">
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="15days">Last 15 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="6months">Last 6 Months</option>
                <option value="1year">Last 1 Year</option>
                <option value="custom">Custom Range</option>
            </Select>
            
            {filterType === 'custom' && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                    <Input 
                        type="date" 
                        className="h-9 w-auto text-sm" 
                        value={customStart} 
                        onChange={e => setCustomStart(e.target.value)} 
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                        type="date" 
                        className="h-9 w-auto text-sm" 
                        value={customEnd} 
                        onChange={e => setCustomEnd(e.target.value)} 
                    />
                </div>
            )}
            
            <Badge variant="outline" className="h-9 px-3 bg-background flex items-center gap-2 ml-auto md:ml-0">
                <Calendar className="w-3.5 h-3.5" />
                {filteredTransactions.length} records
            </Badge>

            <Button onClick={handleDownloadPDF} variant="outline" size="icon" title="Download Report">
                <Download className="w-4 h-4" />
            </Button>
        </div>
      </div>

      {/* Stats Cards - Redesigned for Mobile Overflow & Aesthetics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Revenue */}
          <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-green-50 to-emerald-100/50">
              <div className="absolute right-0 top-0 p-3 opacity-10">
                  <ArrowUpRight className="w-16 h-16 text-green-600" />
              </div>
              <CardContent className="p-4 relative z-10">
                   <p className="text-[10px] md:text-xs font-bold text-green-700/70 uppercase tracking-wider">Total Revenue</p>
                   <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-sm md:text-lg font-bold text-green-700">₹</span>
                      <span className="text-lg sm:text-2xl font-extrabold text-green-800 tracking-tight truncate w-full" title={`₹${stats.totalRevenue.toLocaleString()}`}>
                          {stats.totalRevenue.toLocaleString()}
                      </span>
                   </div>
              </CardContent>
          </Card>

          {/* Returns */}
          <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-red-50 to-rose-100/50">
              <div className="absolute right-0 top-0 p-3 opacity-10">
                  <ArrowDownLeft className="w-16 h-16 text-red-600" />
              </div>
              <CardContent className="p-4 relative z-10">
                   <p className="text-[10px] md:text-xs font-bold text-red-700/70 uppercase tracking-wider">Returns</p>
                   <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-sm md:text-lg font-bold text-red-700">₹</span>
                      <span className="text-lg sm:text-2xl font-extrabold text-red-800 tracking-tight truncate w-full" title={`₹${stats.totalReturns.toLocaleString()}`}>
                          {stats.totalReturns.toLocaleString()}
                      </span>
                   </div>
              </CardContent>
          </Card>
          
          {/* Net Sales */}
          <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-blue-50 to-indigo-100/50">
              <div className="absolute right-0 top-0 p-3 opacity-10">
                  <IndianRupee className="w-16 h-16 text-blue-600" />
              </div>
              <CardContent className="p-4 relative z-10">
                   <p className="text-[10px] md:text-xs font-bold text-blue-700/70 uppercase tracking-wider">Net Sales</p>
                   <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-sm md:text-lg font-bold text-blue-700">₹</span>
                      <span className="text-lg sm:text-2xl font-extrabold text-blue-800 tracking-tight truncate w-full" title={`₹${stats.netSales.toLocaleString()}`}>
                          {stats.netSales.toLocaleString()}
                      </span>
                   </div>
              </CardContent>
          </Card>

          {/* Gross Profit */}
          <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-amber-50 to-orange-100/50">
              <div className="absolute right-0 top-0 p-3 opacity-10">
                  <TrendingUp className="w-16 h-16 text-amber-600" />
              </div>
              <CardContent className="p-4 relative z-10">
                   <p className="text-[10px] md:text-xs font-bold text-amber-700/70 uppercase tracking-wider">Gross Profit</p>
                   <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-sm md:text-lg font-bold text-amber-700">₹</span>
                      <span className="text-lg sm:text-2xl font-extrabold text-amber-800 tracking-tight truncate w-full" title={`₹${stats.grossProfit.toLocaleString()}`}>
                          {stats.grossProfit.toLocaleString()}
                      </span>
                   </div>
              </CardContent>
          </Card>
      </div>

      {/* Responsive Transaction Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Transaction History
        </h2>
        
        {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 opacity-50" />
                </div>
                <p className="font-medium">No transactions found</p>
                <p className="text-sm">Try changing the date filter.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTransactions.map(tx => {
                    const isSale = tx.type === 'sale';
                    const itemCount = tx.items.reduce((acc, item) => acc + item.quantity, 0);
                    
                    return (
                        <Card 
                            key={tx.id} 
                            className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 border-l-4"
                            style={{ borderLeftColor: isSale ? '#22c55e' : '#ef4444' }}
                            onClick={() => setSelectedTx(tx)}
                        >
                            <CardContent className="p-4 flex flex-col gap-4">
                                {/* Header: ID & Badge */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground bg-muted/50 border-transparent px-1.5">
                                                #{tx.id.slice(-6)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(tx.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={isSale ? 'success' : 'destructive'} className="text-[10px] font-bold uppercase tracking-wider px-2 h-5 mb-1 block w-fit ml-auto">
                                            {isSale ? 'SALE' : 'RETURN'}
                                        </Badge>
                                        <div className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                            {tx.paymentMethod || 'Cash'}
                                        </div>
                                    </div>
                                </div>

                                {/* Main: Amount */}
                                <div>
                                    <div className={`text-2xl font-bold flex items-center ${isSale ? 'text-green-600' : 'text-red-600'}`}>
                                        {isSale ? <ArrowUpRight className="w-5 h-5 mr-1" /> : <ArrowDownLeft className="w-5 h-5 mr-1" />}
                                        ₹{Math.abs(tx.total).toLocaleString()}
                                    </div>
                                </div>

                                {/* Footer: Customer & Details */}
                                <div className="pt-3 mt-auto border-t flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                            <User className="w-3 h-3" />
                                        </div>
                                        <span className="font-medium text-foreground max-w-[100px] truncate" title={tx.customerName}>
                                            {tx.customerName || 'Walk-in'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium bg-muted/30 px-2 py-1 rounded text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <Package className="w-3.5 h-3.5" />
                                        <span>{itemCount} Items</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <Card className="w-full max-w-md animate-in zoom-in duration-200 flex flex-col max-h-[90vh] shadow-2xl">
                  <CardHeader className="border-b pb-3 shrink-0 bg-muted/5">
                      <div className="flex justify-between items-center">
                          <CardTitle className="text-lg flex items-center gap-2">
                              {selectedTx.type === 'sale' ? 'Sale Receipt' : 'Return Receipt'}
                              <span className="text-xs font-normal text-muted-foreground font-mono">#{selectedTx.id}</span>
                          </CardTitle>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedTx(null)}><X className="w-4 h-4" /></Button>
                      </div>
                  </CardHeader>
                  <CardContent className="overflow-y-auto p-0">
                      <div className="p-5 space-y-5">
                          {/* Info Header */}
                          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-xl border">
                              <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Date</p>
                                  <p className="font-medium flex items-center gap-1.5">
                                     <Calendar className="w-3.5 h-3.5 text-primary" />
                                     {new Date(selectedTx.date).toLocaleString()}
                                  </p>
                              </div>
                              <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Customer</p>
                                  <p className="font-medium flex items-center gap-1.5">
                                      <User className="w-3.5 h-3.5 text-primary" />
                                      {selectedTx.customerName || 'Walk-in'}
                                  </p>
                              </div>
                              <div className="col-span-2 border-t pt-2 mt-1">
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Payment Method</p>
                                  <p className="font-medium flex items-center gap-1.5 text-primary">
                                      <CreditCard className="w-3.5 h-3.5" />
                                      {selectedTx.paymentMethod || 'Cash'}
                                  </p>
                              </div>
                          </div>

                          {/* Items */}
                          <div className="space-y-3">
                              <p className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                                  <Package className="w-4 h-4 text-primary" />
                                  Items Purchased
                              </p>
                              {selectedTx.items.map((item, idx) => (
                                  <div key={idx} className="flex gap-3 items-start p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                      <div className="h-10 w-10 bg-white rounded border flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                          {item.image ? (
                                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                          ) : (
                                              <span className="text-[8px] text-muted-foreground">IMG</span>
                                          )}
                                      </div>
                                      <div className="flex-1">
                                          <div className="flex justify-between items-start">
                                              <p className="font-medium text-sm leading-tight">{item.name}</p>
                                              <p className="font-medium text-sm">₹{(item.sellPrice * item.quantity).toFixed(2)}</p>
                                          </div>
                                          <div className="flex justify-between items-center mt-1">
                                              <p className="text-xs text-muted-foreground">SKU: {item.barcode}</p>
                                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                                  {item.quantity} x ₹{item.sellPrice}
                                              </Badge>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {/* Footer Breakdown */}
                          <div className="bg-muted/10 p-4 rounded-xl border-2 border-dashed border-muted space-y-2">
                              {/* Subtotal */}
                              <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Subtotal</span>
                                  <span>₹{selectedTx.subtotal ? selectedTx.subtotal.toFixed(2) : Math.abs(selectedTx.total).toFixed(2)}</span>
                              </div>
                              
                              {/* Discount */}
                              {selectedTx.discount ? (
                                  <div className="flex justify-between text-xs text-green-600">
                                      <span>Discount</span>
                                      <span>-₹{selectedTx.discount.toFixed(2)}</span>
                                  </div>
                              ) : null}

                              {/* Tax */}
                              {selectedTx.tax ? (
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>GST (18%)</span>
                                      <span>+₹{selectedTx.tax.toFixed(2)}</span>
                                  </div>
                              ) : null}

                              <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold text-xl">
                                  <span>Total</span>
                                  <span className={selectedTx.type === 'sale' ? 'text-green-700' : 'text-red-700'}>
                                      {selectedTx.type === 'sale' ? '' : '-'}₹{Math.abs(selectedTx.total).toFixed(2)}
                                  </span>
                              </div>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}
    </div>
  );
}


import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, Transaction } from '../types';
import { useStockFlow } from '../services/storage';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Select, Input } from '../components/ui';
import { Users, Phone, Calendar, ArrowRight, History, X, Eye, IndianRupee, FileText, Download, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown, PhoneCall, ChevronRight } from 'lucide-react';

export default function Customers() {
  const { customers, transactions } = useStockFlow();
  
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortBy, setSortBy] = useState<'spend' | 'visits' | 'lastVisit'>('spend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredData = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const relevantTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        txDate.setHours(0,0,0,0);
        switch(filterType) {
            case 'today': return txDate.getTime() === now.getTime();
            case '7days': const week = new Date(now); week.setDate(week.getDate() - 7); return txDate >= week;
            case '30days': const days30 = new Date(now); days30.setDate(days30.getDate() - 30); return txDate >= days30;
            case 'custom':
                if (!customStart) return true;
                const start = new Date(customStart); start.setHours(0,0,0,0); if (txDate < start) return false;
                if (customEnd) { const end = new Date(customEnd); end.setHours(23,59,59,999); if (txDate > end) return false; }
                return true;
            default: return true;
        }
    });

    const customerStats = new Map<string, { spend: number, visits: number }>();
    for (const tx of relevantTransactions) {
        if (!tx.customerId) continue;
        const current = customerStats.get(tx.customerId) || { spend: 0, visits: 0 };
        current.spend += (tx.type === 'sale' ? tx.total : -Math.abs(tx.total));
        current.visits += 1;
        customerStats.set(tx.customerId, current);
    }

    let processedCustomers = customers.map(c => {
        const stats = customerStats.get(c.id);
        return { ...c, displaySpend: filterType === 'all_time' ? c.totalSpend : (stats?.spend || 0), displayVisits: filterType === 'all_time' ? c.visitCount : (stats?.visits || 0) };
    });

    if (searchQuery) { const lowerQ = searchQuery.toLowerCase(); processedCustomers = processedCustomers.filter(c => c.name.toLowerCase().includes(lowerQ) || c.phone.includes(lowerQ)); }
    if (filterType !== 'all_time') { processedCustomers = processedCustomers.filter(c => customerStats.has(c.id)); }

    processedCustomers.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'spend') { valA = a.displaySpend; valB = b.displaySpend; } 
        else if (sortBy === 'visits') { valA = a.displayVisits; valB = b.displayVisits; } 
        else { valA = new Date(a.lastVisit).getTime(); valB = new Date(b.lastVisit).getTime(); }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return { displayCustomers: processedCustomers, relevantTransactions };
  }, [customers, transactions, filterType, customStart, customEnd, searchQuery, sortBy, sortOrder]);

  const customerHistory = useMemo(() => {
      if (!viewingCustomer) return [];
      return transactions.filter(t => t.customerId === viewingCustomer.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, viewingCustomer]);

  const generateIndividualPDF = () => {
      if (!viewingCustomer) return;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text("Customer History Report", 14, 20);
      doc.setFontSize(10); doc.setTextColor(200, 200, 200); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
      doc.setTextColor(0, 0, 0); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(viewingCustomer.name, 14, 55);
      doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(`Phone: ${viewingCustomer.phone}`, 14, 62);
      doc.setFillColor(240, 249, 255); doc.roundedRect(pageWidth - 80, 50, 66, 20, 2, 2, 'F');
      doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.text("Total Lifetime Spend", pageWidth - 74, 56);
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42); doc.text(`Rs.${viewingCustomer.totalSpend.toFixed(2)}`, pageWidth - 74, 64);
      let yPos = 85;

      customerHistory.forEach((tx) => {
          if (yPos > 250) { doc.addPage(); yPos = 20; }
          const isSale = tx.type === 'sale';
          doc.setFillColor(isSale ? 240 : 254, isSale ? 253 : 242, isSale ? 244 : 242); 
          doc.setDrawColor(isSale ? 220 : 254, isSale ? 252 : 226, isSale ? 231 : 226);
          doc.roundedRect(14, yPos, pageWidth - 28, 12, 1, 1, 'FD');
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0); doc.text(`${new Date(tx.date).toLocaleDateString()}  •  #${tx.id.slice(-6)}`, 18, yPos + 8);
          doc.setFontSize(9); doc.setTextColor(isSale ? 22 : 185, isSale ? 101 : 28, isSale ? 52 : 28); doc.text(isSale ? "SALE" : "RETURN", 80, yPos + 8);
          doc.setFontSize(10); doc.setTextColor(0,0,0); doc.text(`${isSale ? '+' : ''}Rs.${Math.abs(tx.total).toFixed(2)}`, pageWidth - 18, yPos + 8, { align: 'right' });
          yPos += 14;
          const tableBody = tx.items.map(item => { const gross = item.sellPrice * item.quantity; const disc = item.discountAmount || 0; const net = gross - disc; return ['', item.name, item.sku, item.quantity, `Rs.${item.sellPrice.toFixed(2)}`, disc > 0 ? `Rs.${disc.toFixed(2)}` : '-', `Rs.${net.toFixed(2)}`]; });
          autoTable(doc, { startY: yPos, head: [['Img', 'Product', 'SKU', 'Qty', 'Price', 'Disc', 'Net']], body: tableBody, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, minCellHeight: 10, valign: 'middle', lineColor: [230, 230, 230], lineWidth: 0.1 }, headStyles: { fillColor: [255, 255, 255], textColor: [100, 116, 139], fontStyle: 'bold', lineWidth: 0 }, columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 'auto' }, 4: { halign: 'right' }, 5: { halign: 'right', textColor: [22, 163, 74] }, 6: { halign: 'right', fontStyle: 'bold' } }, didDrawCell: (data) => { if (data.section === 'body' && data.column.index === 0) { const item = tx.items[data.row.index]; if (item.image && item.image.startsWith('data:image')) { try { doc.addImage(item.image, 'JPEG', data.cell.x + 1, data.cell.y + 1, 8, 8); } catch (e) {} } } } });
          yPos = (doc as any).lastAutoTable.finalY + 4;
          doc.setFontSize(8); doc.setTextColor(100);
          const summaryX = pageWidth - 60; const subtotal = tx.subtotal || tx.items.reduce((acc, i) => acc + (i.sellPrice * i.quantity), 0); const tax = tx.tax || 0; const disc = tx.discount || 0;
          if (yPos + 20 > 280) { doc.addPage(); yPos = 20; }
          doc.text("Subtotal:", summaryX, yPos); doc.text(`Rs.${subtotal.toFixed(2)}`, pageWidth - 14, yPos, { align: 'right' }); yPos += 4;
          if (disc > 0) { doc.text("Discount:", summaryX, yPos); doc.setTextColor(22, 163, 74); doc.text(`-Rs.${disc.toFixed(2)}`, pageWidth - 14, yPos, { align: 'right' }); doc.setTextColor(100); yPos += 4; }
          if (tax > 0) { doc.text("GST:", summaryX, yPos); doc.text(`+Rs.${tax.toFixed(2)}`, pageWidth - 14, yPos, { align: 'right' }); yPos += 4; }
          doc.setFont("helvetica", "bold"); doc.setTextColor(0); doc.text("Total:", summaryX, yPos); doc.text(`Rs.${Math.abs(tx.total).toFixed(2)}`, pageWidth - 14, yPos, { align: 'right' });
          yPos += 12;
      });
      doc.save(`${viewingCustomer.name.replace(/\s+/g, '_')}_History.pdf`);
  };

  const generateAllCustomersPDF = () => {
      if (filteredData.displayCustomers.length === 0) { alert("No customer data available to download."); return; }
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(20); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.text("Customer Database Report", 14, 20);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(203, 213, 225); doc.text("StockFlow Inc.", 14, 26); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
      const grossTotal = filteredData.displayCustomers.reduce((sum, c) => sum + c.displaySpend, 0);
      const totalVisits = filteredData.displayCustomers.reduce((sum, c) => sum + c.displayVisits, 0);
      doc.setFillColor(241, 245, 249); doc.roundedRect(14, 45, pageWidth - 28, 25, 2, 2, 'F');
      doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.text("Gross Revenue (Period)", 20, 54);
      doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.text(`Rs.${grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 20, 62);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139); doc.text("Active Customers", 90, 54);
      doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.text(`${filteredData.displayCustomers.length}`, 90, 62);
      doc.setFontSize(9); doc.setTextColor(100); doc.text(`Filter Applied: ${filterType === 'all_time' ? 'All Time' : filterType}`, pageWidth - 20, 54, { align: 'right' });
      const tableBody = filteredData.displayCustomers.map(c => [c.name, c.phone, c.displayVisits, new Date(c.lastVisit).toLocaleDateString(), `Rs.${c.displaySpend.toFixed(2)}`]);
      tableBody.push(['TOTAL', '', `${totalVisits}`, '', `Rs.${grossTotal.toFixed(2)}`]);
      autoTable(doc, { startY: 75, head: [['Name', 'Phone', 'Visits', 'Last Visit', 'Spend']], body: tableBody, theme: 'striped', styles: { fontSize: 10, cellPadding: 4, valign: 'middle' }, headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', halign: 'left' }, columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } }, didParseCell: (data) => { if (data.section === 'body' && data.row.index === tableBody.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [226, 232, 240]; data.cell.styles.textColor = [15, 23, 42]; } } });
      doc.save(`StockFlow_Customers_${filterType}.pdf`);
  };

  const toggleSortOrder = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

  return (
    <div className="space-y-6 pb-20 md:pb-0 relative">
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-md border-b shadow-sm space-y-3">
          <div className="flex justify-between items-center">
              <div><h1 className="text-xl md:text-3xl font-bold tracking-tight">Customers</h1><p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Manage client database and logs.</p></div>
              <div className="flex gap-2"><Button onClick={generateAllCustomersPDF} variant="outline" size="sm" className="h-8 md:h-9"><FileText className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Export List</span></Button></div>
          </div>
          <div className="flex flex-col gap-2">
              <div className="relative w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search customers..." className="pl-9 h-10 bg-muted/50 border-transparent focus:bg-background focus:border-input rounded-xl transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />{searchQuery && (<Button variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery('')}><X className="w-3 h-3" /></Button>)}</div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 items-center">
                 <div className="flex items-center bg-muted/50 rounded-lg px-1 border shrink-0 h-9">
                    <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="h-full text-xs border-0 bg-transparent focus:ring-0 w-32 py-0 pl-2"><option value="spend">Sort: Spend</option><option value="visits">Sort: Visits</option><option value="lastVisit">Sort: Recent</option></Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md ml-1" onClick={toggleSortOrder}>{sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}</Button>
                 </div>
                 <div className="flex items-center bg-muted/50 rounded-lg px-1 border shrink-0 h-9">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
                    <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-full text-xs border-0 bg-transparent focus:ring-0 w-28 py-0 pl-2"><option value="all_time">All Time</option><option value="today">Today</option><option value="7days">7 Days</option><option value="30days">30 Days</option><option value="custom">Custom</option></Select>
                 </div>
                 {filterType === 'custom' && (<div className="flex items-center gap-2 animate-in fade-in"><Input type="date" className="h-9 w-32 text-xs" value={customStart} onChange={e => setCustomStart(e.target.value)} /><Input type="date" className="h-9 w-32 text-xs" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></div>)}
            </div>
          </div>
      </div>

      <div className="space-y-4">
          <div className="flex items-center justify-between px-1"><Badge variant="outline" className="font-normal text-muted-foreground bg-background">{filteredData.displayCustomers.length} Clients Found</Badge></div>
          {filteredData.displayCustomers.length === 0 ? (<div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-2xl border-2 border-dashed"><div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-muted-foreground/30" /></div><p className="text-lg font-medium text-foreground">No customers found</p><p className="text-sm text-muted-foreground">Try adjusting your filters</p></div>) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {filteredData.displayCustomers.map(customer => {
                      const isHighValue = customer.totalSpend > 5000;
                      const gradientIndex = customer.name.length % 5;
                      const gradients = ['from-blue-500 to-indigo-500', 'from-emerald-500 to-teal-500', 'from-orange-500 to-red-500', 'from-purple-500 to-pink-500', 'from-cyan-500 to-blue-500'];
                      return (
                        <Card key={customer.id} className={`cursor-pointer hover:shadow-lg transition-all duration-200 group border-l-4 overflow-hidden relative ${isHighValue ? 'border-l-primary' : 'border-l-transparent'}`} onClick={() => setViewingCustomer(customer)}>
                            <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="md:hidden absolute top-4 right-4 p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 z-10"><PhoneCall className="w-4 h-4" /></a>
                            <CardContent className="p-4 sm:p-5 flex flex-row sm:flex-col items-center sm:items-start gap-4">
                                <div className="flex-shrink-0"><div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-md bg-gradient-to-br ${gradients[gradientIndex]}`}>{customer.name.charAt(0).toUpperCase()}</div></div>
                                <div className="flex-1 min-w-0"><h3 className="font-bold text-base truncate pr-8 sm:pr-0">{customer.name}</h3><div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Phone className="w-3 h-3" /> <span>{customer.phone}</span></div><div className="flex sm:hidden items-center gap-3 mt-2"><Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-muted/50">{customer.displayVisits} Visits</Badge><span className="text-xs font-bold text-primary">₹{customer.displaySpend.toLocaleString()}</span></div></div>
                                <div className="hidden sm:grid w-full grid-cols-2 gap-3 mt-2"><div className="bg-muted/30 p-2 rounded-md"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Spend</p><p className={`font-bold text-sm ${filterType !== 'all_time' ? 'text-primary' : ''}`}>₹{customer.displaySpend.toLocaleString()}</p></div><div className="bg-muted/30 p-2 rounded-md"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Visits</p><p className="font-bold text-sm">{customer.displayVisits}</p></div></div>
                                <div className="hidden sm:flex w-full items-center justify-between text-xs text-muted-foreground pt-3 border-t"><div className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /><span>{new Date(customer.lastVisit).toLocaleDateString()}</span></div>{isHighValue && <Badge variant="success" className="h-4 text-[9px] px-1.5">Top Client</Badge>}</div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground/30 sm:hidden ml-auto" />
                            </CardContent>
                        </Card>
                      );
                  })}
              </div>
          )}
      </div>

      {viewingCustomer && (
          <div className="fixed inset-0 bg-black/60 sm:backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
              <Card className="w-full h-[95vh] sm:h-[85vh] sm:max-w-lg flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in duration-300 rounded-t-2xl sm:rounded-xl shadow-2xl border-0 sm:border">
                  <CardHeader className="bg-muted/10 border-b pb-4 shrink-0 relative">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full sm:hidden"></div>
                      <div className="flex justify-between items-start mt-2 sm:mt-0">
                          <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shadow-sm">{viewingCustomer.name.charAt(0).toUpperCase()}</div>
                                <div><CardTitle className="text-xl">{viewingCustomer.name}</CardTitle><div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-3 h-3" /> <a href={`tel:${viewingCustomer.phone}`} className="hover:text-primary">{viewingCustomer.phone}</a></div></div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-muted/50 rounded-full" onClick={() => setViewingCustomer(null)}><X className="w-4 h-4" /></Button>
                      </div>
                      <div className="flex gap-2 mt-5">
                           <div className="flex-1 bg-gradient-to-r from-primary/5 to-transparent p-3 rounded-lg border border-primary/10"><div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Lifetime Spend</div><div className="text-xl font-bold text-primary">₹{viewingCustomer.totalSpend.toFixed(2)}</div></div>
                           <Button variant="outline" className="h-auto flex-col gap-1 text-xs px-4 border-dashed" onClick={generateIndividualPDF}><Download className="w-4 h-4" /><span>Report</span></Button>
                      </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-0 bg-background">
                      {customerHistory.length === 0 ? (<div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><History className="w-10 h-10 mb-2 opacity-30" /><p>No purchase history found.</p></div>) : (
                          <div className="divide-y">
                              <div className="bg-muted/20 p-2 text-[10px] uppercase font-bold text-muted-foreground flex justify-between px-4 sticky top-0 backdrop-blur-md z-10 border-b"><span>Activity Log</span><span>{customerHistory.length} Records</span></div>
                              {customerHistory.map(tx => (
                                  <div key={tx.id} className="p-4 hover:bg-muted/5 flex justify-between items-center group cursor-pointer transition-colors active:bg-muted/10" onClick={() => setSelectedTx(tx)}>
                                      <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2"><Badge variant={tx.type === 'sale' ? 'success' : 'destructive'} className="h-5 px-1.5 text-[10px] uppercase tracking-wide">{tx.type}</Badge><span className="text-xs text-muted-foreground font-mono">#{tx.id.slice(-6)}</span></div>
                                          <div className="text-sm font-medium">{new Date(tx.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Eye className="w-3 h-3" /> {tx.items.length} Items</div>
                                      </div>
                                      <div className="text-right"><div className={`text-base font-bold ${tx.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'sale' ? '+' : ''}₹{Math.abs(tx.total).toFixed(2)}</div><ArrowRight className="w-4 h-4 text-muted-foreground ml-auto opacity-30" /></div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </CardContent>
              </Card>
          </div>
      )}

      {selectedTx && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
              <Card className="w-full max-w-md animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                  <CardHeader className="border-b pb-3 shrink-0"><div className="flex justify-between items-center"><CardTitle className="text-lg flex items-center gap-2">{selectedTx.type === 'sale' ? 'Bill Details' : 'Return Details'}<span className="text-xs font-normal text-muted-foreground font-mono">#{selectedTx.id.slice(-6)}</span></CardTitle><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTx(null)}><X className="w-4 h-4" /></Button></div></CardHeader>
                  <CardContent className="overflow-y-auto p-4 space-y-4">
                      <div className="flex justify-between text-sm bg-muted/20 p-3 rounded-lg"><div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{new Date(selectedTx.date).toLocaleString()}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className={`font-bold ${selectedTx.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>{selectedTx.type === 'sale' ? '+' : '-'}₹{Math.abs(selectedTx.total).toFixed(2)}</p></div></div>
                      <div className="space-y-3">
                          <p className="text-sm font-semibold border-b pb-1 mb-2">Items</p>
                          {selectedTx.items.map((item, idx) => (
                              <div key={idx} className="flex gap-3 items-start p-2 rounded hover:bg-muted/10 border border-transparent hover:border-muted/30">
                                  <div className="h-12 w-12 bg-white rounded border flex items-center justify-center shrink-0 overflow-hidden">{item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-[9px] text-muted-foreground">No Img</span>}</div>
                                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" title={item.name}>{item.name}</p><p className="text-xs text-muted-foreground">SKU: {item.sku}</p><div className="flex justify-between items-center mt-1"><Badge variant="outline" className="text-[10px] h-4 px-1 font-normal bg-muted/50">Qty: {item.quantity}</Badge><div>{item.discountAmount ? <span className="text-[10px] text-green-600 mr-2">Disc: -₹{item.discountAmount}</span> : null}<span className="text-sm font-bold">₹{((item.sellPrice * item.quantity) - (item.discountAmount || 0)).toFixed(2)}</span></div></div></div>
                              </div>
                          ))}
                      </div>
                      <div className="bg-muted/10 p-4 rounded-xl border-2 border-dashed border-muted space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{selectedTx.subtotal ? selectedTx.subtotal.toFixed(2) : Math.abs(selectedTx.total).toFixed(2)}</span></div>
                          {selectedTx.discount ? <div className="flex justify-between text-xs text-green-600"><span>Discount</span><span>-₹{selectedTx.discount.toFixed(2)}</span></div> : null}
                          {selectedTx.tax ? <div className="flex justify-between text-xs text-muted-foreground"><span>GST (18%)</span><span>+₹{selectedTx.tax.toFixed(2)}</span></div> : null}
                          <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold text-xl"><span>Total</span><span className={selectedTx.type === 'sale' ? 'text-green-700' : 'text-red-700'}>{selectedTx.type === 'sale' ? '' : '-'}₹{Math.abs(selectedTx.total).toFixed(2)}</span></div>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}
    </div>
  );
}

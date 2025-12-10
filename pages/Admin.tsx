import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'react-qr-code';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product } from '../types';
import { useStockFlow, addProduct, updateProduct, deleteProduct, addCategory, deleteCategory } from '../services/storage';
import { Button, Input, Select, Card, CardContent, CardHeader, CardTitle, Label, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui';
import { Plus, Trash2, Edit, Save, X, Search, QrCode, Download, Share2, AlertCircle, Tags, FileDown, Package, Coins, AlertTriangle, Layers } from 'lucide-react';

export default function Admin() {
  const { products, categories, profile } = useStockFlow();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Filters & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('name-asc');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const [qrPreview, setQrPreview] = useState<Product | null>(null);
  const [isStockAlertModalOpen, setIsStockAlertModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({ name: '', sku: '', buyPrice: '', sellPrice: '', stock: '', description: '', category: '', hsn: '' });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!formData.name || !formData.sku || !formData.category || formData.buyPrice === '' || formData.sellPrice === '' || formData.stock === '') {
        setError("Please fill in all required fields marked with *");
        return;
    }
    setError(null);
    const productPayload = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      image: formData.image || '', 
      ...formData,
      buyPrice: Number(formData.buyPrice),
      sellPrice: Number(formData.sellPrice),
      stock: Number(formData.stock)
    } as Product;

    if (editingProduct) await updateProduct(productPayload);
    else await addProduct(productPayload);
    closeModal();
  };

  const handleDelete = async (id: string) => { if (window.confirm('Are you sure?')) await deleteProduct(id); };
  const handleAddCategory = async () => { if(!newCategoryName.trim()) return; await addCategory(newCategoryName.trim()); setNewCategoryName(''); };
  const handleDeleteCategory = async (cat: string) => { if(window.confirm(`Delete category "${cat}"?`)) await deleteCategory(cat); };

  const openModal = (product?: Product) => {
    setError(null);
    if (product) { setEditingProduct(product); setFormData(product); } 
    else { setEditingProduct(null); setFormData({ name: '', sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`, buyPrice: '', sellPrice: '', stock: '', description: '', category: '', hsn: '' }); }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditingProduct(null); setError(null); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(img, 0, 0, width, height); setFormData((prev: any) => ({ ...prev, image: canvas.toDataURL('image/jpeg', 0.7 as any) })); }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const getQRDataUrl = (): Promise<string | null> => {
      const svg = document.getElementById("qr-code-svg");
      if (!svg) return Promise.resolve(null);
      const canvas = document.createElement("canvas");
      canvas.width = 600; canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if(!ctx) return Promise.resolve(null);
      ctx.fillStyle = "white"; ctx.fillRect(0,0, 600, 300);
      ctx.strokeStyle = "black"; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 580, 280);
      ctx.fillStyle = "black"; ctx.font = "bold 24px Arial"; ctx.fillText(String(qrPreview?.name || ""), 240, 60);
      ctx.font = "bold 40px Monospace"; ctx.fillText(String(qrPreview?.sku || ""), 240, 120);
      ctx.font = "20px Arial"; ctx.fillStyle = "#666"; ctx.fillText(`₹${qrPreview?.sellPrice}`, 240, 160);
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.src = "data:image/svg+xml;base64," + btoa(svgData || "");
      return new Promise<string | null>((resolve) => { img.onload = () => { ctx.drawImage(img, 30, 50, 200, 200); resolve(canvas.toDataURL("image/png")); }; img.onerror = () => resolve(null); });
  };
  const downloadQR = async () => { const dataUrl = await getQRDataUrl(); if (dataUrl) { const downloadLink = document.createElement("a"); downloadLink.download = `${qrPreview?.sku}-LANDSCAPE.png`; downloadLink.href = dataUrl; downloadLink.click(); } };
  const shareQR = async () => {
      const dataUrl = await getQRDataUrl();
      if (dataUrl && navigator.share) { const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], "qr.png", { type: "image/png" }); try { await navigator.share({ title: `QR for ${qrPreview?.name}`, text: `SKU: ${qrPreview?.sku}`, files: [file] }); } catch (e) {} } 
      else { alert("Sharing not supported on this device/browser."); }
  };

  const filterCategories = useMemo(() => ['all', ...categories], [categories]);
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase())) && (categoryFilter === 'all' || p.category === categoryFilter));
    result.sort((a, b) => {
      switch(sortOption) { case 'name-asc': return a.name.localeCompare(b.name); case 'price-asc': return a.buyPrice - b.buyPrice; case 'price-desc': return b.buyPrice - a.buyPrice; case 'stock-asc': return a.stock - b.stock; default: return 0; }
    });
    return result;
  }, [products, searchTerm, sortOption, categoryFilter]);

  const stats = useMemo(() => {
      const totalInventoryValue = products.reduce((acc, p) => acc + (p.stock * p.buyPrice), 0);
      const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < 5);
      const outOfStockProducts = products.filter(p => p.stock === 0);
      return { totalInventoryValue, lowStockCount: lowStockProducts.length, outOfStockCount: outOfStockProducts.length, lowStockProducts, outOfStockProducts };
  }, [products]);

  const handleDownloadCategoryPDF = () => {
      if (filteredProducts.length === 0) { alert("No products found to download."); return; }
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10; const cols = 3; const colGap = 5; const rowGap = 5;
      const contentWidth = pageWidth - (margin * 2);
      const cardWidth = (contentWidth - ((cols - 1) * colGap)) / cols;
      const cardHeight = 60; 

      let x = margin; let y = 30;
      doc.setFontSize(18); doc.setTextColor(40, 40, 40);
      const title = categoryFilter === 'all' ? "Customer Catalog - All Categories" : `Customer Catalog - ${categoryFilter}`;
      doc.text(title, pageWidth/2, 15, { align: "center" } as any);
      doc.setFontSize(10); doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth/2, 22, { align: "center" } as any);
      doc.setDrawColor(200, 200, 200); doc.line(margin, 25, pageWidth - margin, 25);

      filteredProducts.forEach((product, index) => {
          if (y + cardHeight > pageHeight - margin) { doc.addPage(); y = margin; }
          doc.setDrawColor(230, 230, 230); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');
          const imgSize = 30; const imgX = x + (cardWidth - imgSize) / 2; const imgY = y + 5;
          try { if (product.image && product.image.startsWith('data:image')) doc.addImage(product.image, 'JPEG', imgX, imgY, imgSize, imgSize, undefined, 'FAST'); else { doc.setFillColor(245, 245, 245); doc.rect(imgX, imgY, imgSize, imgSize, 'F'); doc.setFontSize(8); doc.setTextColor(150); doc.text("No Image", imgX + imgSize/2, imgY + imgSize/2, { align: "center" }); } } catch (e) { doc.setFillColor(245); doc.rect(imgX, imgY, imgSize, imgSize, 'F'); }
          const textStartY = imgY + imgSize + 5; 
          doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
          const titleLines = doc.splitTextToSize(product.name, cardWidth - 6); doc.text(titleLines[0], x + 3, textStartY);
          const skuY = textStartY + 4; doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.text(product.sku, x + 3, skuY); 
          const priceY = skuY + 8; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.text(`Rs.${product.sellPrice}`, x + 3, priceY);
          const inStock = product.stock > 0; const badgeText = inStock ? "In Stock" : "Out of Stock"; const badgeWidth = doc.getTextWidth(badgeText) + 6; const badgeX = x + cardWidth - badgeWidth - 3; const badgeRectY = priceY - 5; 
          if (inStock) { doc.setFillColor(209, 250, 229); doc.setTextColor(6, 95, 70); } else { doc.setFillColor(254, 226, 226); doc.setTextColor(185, 28, 28); }
          doc.roundedRect(badgeX, badgeRectY, badgeWidth, 7, 2, 2, 'F'); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(badgeText, badgeX + 3, priceY);
          x += cardWidth + colGap; if (index > 0 && (index + 1) % cols === 0) { x = margin; y += cardHeight + rowGap; }
      });
      doc.save(`customer-catalog-${categoryFilter}.pdf`);
  };

  const generateStockAlertPDF = () => {
      const items = [...stats.lowStockProducts, ...stats.outOfStockProducts];
      if (items.length === 0) return;

      const doc = new jsPDF();
      doc.setFontSize(18); doc.text("Stock Alert Report", 14, 20);
      doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
      
      const tableBody = items.map(p => [
          '', // Placeholder for image
          p.sku,
          p.name,
          p.hsn || '-',
          p.stock === 0 ? "OUT" : "LOW",
          p.stock.toString(),
          `Rs.${p.buyPrice}`,
          `Rs.${p.sellPrice}`
      ]);
      
      autoTable(doc, {
          startY: 30,
          head: [['Img', 'SKU', 'Name', 'HSN', 'Status', 'Qty', 'Buy', 'Sell']],
          body: tableBody,
          styles: { fontSize: 9, valign: 'middle', minCellHeight: 12 },
          headStyles: { fillColor: [200, 0, 0] },
          columnStyles: { 0: { cellWidth: 12 } },
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const item = items[data.row.index];
                if (item.image && item.image.startsWith('data:image')) {
                    try {
                        doc.addImage(item.image, 'JPEG', data.cell.x + 1, data.cell.y + 1, 10, 10);
                    } catch (e) {}
                }
            }
          }
      });
      doc.save('stock_alert_report.pdf');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20 md:pb-0">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full md:col-span-1 lg:col-span-2 space-y-1"><h1 className="text-3xl font-bold tracking-tight text-foreground">Inventory</h1><p className="text-muted-foreground">Manage your stock, products, and pricing.</p></div>
          <Card className="bg-blue-50/50 border-blue-100 shadow-sm relative overflow-hidden group">
               <CardContent className="p-4 flex flex-col justify-between h-full relative z-10"><div><p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Inventory Value (Cost)</p><p className="text-2xl font-bold text-blue-900 mt-1">₹{stats.totalInventoryValue.toLocaleString()}</p></div><div className="absolute right-2 top-2 p-2 bg-blue-100 rounded-lg text-blue-600 opacity-50 group-hover:opacity-100 transition-opacity"><Coins className="w-5 h-5" /></div></CardContent>
          </Card>
          <Card 
            className="bg-amber-50/50 border-amber-100 shadow-sm relative overflow-hidden group cursor-pointer hover:border-amber-300 transition-colors"
            onClick={() => setIsStockAlertModalOpen(true)}
          >
               <CardContent className="p-4 flex flex-col justify-between h-full relative z-10"><div><p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Low Stock Alerts</p><div className="flex items-end gap-2 mt-1"><p className="text-2xl font-bold text-amber-900">{stats.lowStockCount}</p>{stats.outOfStockCount > 0 && (<span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{stats.outOfStockCount} Out</span>)}</div></div><div className="absolute right-2 top-2 p-2 bg-amber-100 rounded-lg text-amber-600 opacity-50 group-hover:opacity-100 transition-opacity"><AlertTriangle className="w-5 h-5" /></div></CardContent>
          </Card>
      </div>

      <div className="bg-card border rounded-xl p-3 shadow-sm sticky top-0 z-20 bg-opacity-95 backdrop-blur-md">
          <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                  <Input placeholder="Search products..." className="pl-9 bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2 md:flex md:w-auto">
                  <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full md:w-[140px]">{filterCategories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}</Select>
                  <Select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="w-full md:w-[140px]"><option value="name-asc">Name (A-Z)</option><option value="price-asc">Buy Price (Low-High)</option><option value="price-desc">Buy Price (High-Low)</option><option value="stock-asc">Stock (Low-High)</option></Select>
              </div>
              <div className="flex items-center gap-2">
                   <div className="w-px h-9 bg-border mx-1 hidden md:block"></div>
                   <Button variant="outline" size="icon" onClick={() => setIsCategoryModalOpen(true)} title="Manage Categories" className="shrink-0"><Layers className="w-4 h-4" /></Button>
                   <Button variant="outline" size="icon" onClick={handleDownloadCategoryPDF} disabled={filteredProducts.length === 0} title="Download Catalog" className="shrink-0"><FileDown className="w-4 h-4" /></Button>
                   <Button onClick={() => openModal()} className="bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all flex-1 md:flex-none"><Plus className="w-4 h-4 mr-2" /> <span className="md:inline">Add Product</span></Button>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {filteredProducts.map(product => {
            const isOutOfStock = product.stock === 0;
            const isLowStock = product.stock > 0 && product.stock < 5;
            return (
              <Card key={product.id} className="group overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-muted/60">
                 <div className="relative aspect-square w-full bg-gray-50 flex items-center justify-center overflow-hidden">
                    {product.image ? (<img src={product.image} alt={product.name} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />) : (<div className="text-center p-2 opacity-30"><Package className="w-8 h-8 mx-auto mb-1" /><p className="text-[9px] font-medium">No Image</p></div>)}
                    <div className="absolute top-2 right-2">
                        {isOutOfStock ? (<Badge variant="destructive" className="h-5 px-1.5 text-[10px] shadow-sm">Out</Badge>) : isLowStock ? (<Badge variant="secondary" className="bg-amber-100 text-amber-700 h-5 px-1.5 text-[10px] shadow-sm hover:bg-amber-200">Low</Badge>) : (<Badge variant="success" className="h-5 px-1.5 text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">{product.stock}</Badge>)}
                    </div>
                 </div>
                 <CardContent className="p-2 sm:p-3 relative bg-card">
                    <div className="mb-2">
                        <h3 className="font-semibold truncate text-[11px] sm:text-sm text-foreground leading-tight" title={product.name}>{product.name}</h3>
                        <div className="flex items-center gap-1 mt-1 text-[9px] sm:text-[10px] text-muted-foreground"><span className="font-mono bg-muted px-1 rounded truncate max-w-[50%]">{product.sku}</span><span className="truncate text-gray-400">|</span><span className="truncate text-blue-600 font-medium">{product.category}</span></div>
                        <div className="flex items-end justify-between mt-2"><div className="flex flex-col"><span className="text-[9px] text-muted-foreground leading-none">Cost</span><span className="font-bold text-sm sm:text-base text-primary">₹{product.buyPrice}</span></div><p className="text-[9px] sm:text-[10px] text-muted-foreground">Qty: {product.stock}</p></div>
                    </div>
                    <div className="flex gap-1 justify-between pt-2 border-t border-dashed border-gray-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity delay-75">
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-blue-50 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); openModal(product); }} title="Edit"><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-purple-50 hover:text-purple-600" onClick={(e) => { e.stopPropagation(); setQrPreview(product); }} title="QR Code"><QrCode className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-red-50 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                 </CardContent>
              </Card>
            );
        })}
        {filteredProducts.length === 0 && <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-muted rounded-xl bg-muted/5"><div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4"><Package className="w-8 h-8 text-muted-foreground/40" /></div><h3 className="text-lg font-semibold text-foreground">No products found</h3><Button variant="outline" className="mt-4" onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}>Clear Filters</Button></div>}
      </div>

      {/* Stock Alert Modal */}
      {isStockAlertModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95">
                  <CardHeader className="border-b bg-muted/20 flex flex-row items-center justify-between">
                      <CardTitle>Stock Level Alerts</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setIsStockAlertModalOpen(false)}><X className="w-4 h-4" /></Button>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
                      <div className="p-4 border-b flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Detailed report of products needing attention.</p>
                          <Button size="sm" onClick={generateStockAlertPDF} disabled={stats.lowStockCount === 0 && stats.outOfStockCount === 0}>
                              <Download className="w-4 h-4 mr-2" /> Download Report
                          </Button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                          <Tabs defaultValue="low">
                              <TabsList className="w-full grid grid-cols-2 mb-4">
                                  <TabsTrigger value="low">Low Stock ({stats.lowStockCount})</TabsTrigger>
                                  <TabsTrigger value="out">Out of Stock ({stats.outOfStockCount})</TabsTrigger>
                              </TabsList>
                              <TabsContent value="low" className="space-y-2">
                                  {stats.lowStockProducts.length === 0 && <p className="text-center text-muted-foreground py-8">No low stock items.</p>}
                                  {stats.lowStockProducts.map(p => (
                                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50">
                                          <div className="flex items-center gap-3">
                                              <div className="h-10 w-10 bg-white rounded border overflow-hidden">{p.image && <img src={p.image} className="w-full h-full object-cover" />}</div>
                                              <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.sku}</p></div>
                                          </div>
                                          <Badge variant="secondary" className="bg-amber-200 text-amber-800">{p.stock} left</Badge>
                                      </div>
                                  ))}
                              </TabsContent>
                              <TabsContent value="out" className="space-y-2">
                                  {stats.outOfStockProducts.length === 0 && <p className="text-center text-muted-foreground py-8">Everything in stock!</p>}
                                  {stats.outOfStockProducts.map(p => (
                                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50/50">
                                          <div className="flex items-center gap-3">
                                              <div className="h-10 w-10 bg-white rounded border overflow-hidden">{p.image && <img src={p.image} className="w-full h-full object-cover" />}</div>
                                              <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.sku}</p></div>
                                          </div>
                                          <Badge variant="destructive">0 left</Badge>
                                      </div>
                                  ))}
                              </TabsContent>
                          </Tabs>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-muted/20">
                <CardTitle className="text-xl">{editingProduct ? 'Edit Product' : 'Add New Product'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={closeModal}><X className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
                {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Product Name <span className="text-red-500">*</span></Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Wireless Mouse" /></div>
                    <div className="space-y-2"><Label>SKU <span className="text-red-500">*</span></Label><Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="Unique ID" /></div>
                </div>
                <div className="space-y-2"><Label>HSN Code</Label><Input value={formData.hsn} onChange={e => setFormData({...formData, hsn: e.target.value})} placeholder="Tax HSN Code" /></div>
                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pricing & Stock</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2"><Label>Buy Price</Label><div className="relative"><span className="absolute left-2.5 top-2.5 text-muted-foreground text-xs">₹</span><Input type="number" className="pl-6" value={formData.buyPrice} onChange={e => setFormData({...formData, buyPrice: e.target.value})} placeholder="0.00" /></div></div>
                        <div className="space-y-2"><Label>Sell Price</Label><div className="relative"><span className="absolute left-2.5 top-2.5 text-muted-foreground text-xs">₹</span><Input type="number" className="pl-6 font-bold text-primary" value={formData.sellPrice} onChange={e => setFormData({...formData, sellPrice: e.target.value})} placeholder="0.00" /></div></div>
                        <div className="space-y-2"><Label>Stock Qty</Label><Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} placeholder="0" /></div>
                    </div>
                </div>
                <div className="space-y-2">
                     <Label>Product Image</Label>
                     <div className="flex items-center gap-4 p-3 border rounded-lg border-dashed hover:bg-muted/10 transition-colors">
                        <div className="h-16 w-16 bg-white rounded-md overflow-hidden border flex items-center justify-center shadow-sm">{formData.image ? (<img src={formData.image} alt="Preview" className="h-full w-full object-cover" />) : (<span className="text-[10px] text-muted-foreground">No Image</span>)}</div>
                        <div className="flex-1"><Input type="file" accept="image/*" onChange={handleImageUpload} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" /></div>
                     </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center"><Label>Category <span className="text-red-500">*</span></Label><Button variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary/80 px-2" onClick={() => setIsCategoryModalOpen(true)}>+ Manage</Button></div>
                    <Select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        <option value="">Select Category</option>{categories.map(c => (<option key={c} value={c}>{c}</option>))}
                    </Select>
                </div>
                <div className="space-y-2"><Label>Description</Label><Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional details..." /></div>
                <div className="pt-2"><Button className="w-full h-11 text-base shadow-lg" onClick={handleSave}><Save className="w-4 h-4 mr-2" /> {editingProduct ? 'Update Product' : 'Save Product'}</Button></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
             <Card className="w-full max-w-sm animate-in fade-in zoom-in duration-200 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-muted/20"><CardTitle className="text-lg">Manage Categories</CardTitle><Button variant="ghost" size="sm" onClick={() => setIsCategoryModalOpen(false)}><X className="w-4 h-4" /></Button></CardHeader>
                <CardContent className="space-y-4 pt-4">
                    <div className="flex gap-2"><Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New Category Name" /><Button onClick={handleAddCategory}>Add</Button></div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                        {categories.length === 0 && <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center"><Tags className="w-8 h-8 opacity-20 mb-2"/>No categories yet.</div>}
                        {categories.map(cat => (<div key={cat} className="flex justify-between items-center p-3 bg-card hover:bg-muted/50 transition-colors rounded-lg border shadow-sm group"><span className="text-sm font-medium flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>{cat}</span><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteCategory(cat)}><Trash2 className="w-3.5 h-3.5" /></Button></div>))}
                    </div>
                </CardContent>
             </Card>
          </div>
      )}

      {/* QR Preview Modal (Landscape) */}
      {qrPreview && (
         <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl bg-white text-black overflow-hidden animate-in fade-in zoom-in duration-200">
                <CardHeader className="flex flex-row justify-between items-center border-b"><CardTitle>Product QR (Landscape)</CardTitle><Button variant="ghost" size="sm" onClick={() => setQrPreview(null)}><X className="w-4 h-4" /></Button></CardHeader>
                <CardContent className="p-8 flex flex-col items-center gap-6">
                    <div id="qr-card-landscape" className="flex flex-row items-center border-4 border-black p-6 rounded-xl bg-white shadow-2xl w-full max-w-lg aspect-[2/1]">
                         <div className="bg-white p-2"><QRCode id="qr-code-svg" value={JSON.stringify({ sku: qrPreview.sku })} size={150} level="H" /></div>
                         <div className="flex-1 pl-6 flex flex-col justify-center h-full border-l-2 ml-4 border-dashed border-gray-300"><h2 className="text-4xl font-extrabold tracking-tighter mb-2">{qrPreview.sku}</h2><p className="text-xl font-medium text-gray-600 truncate">{qrPreview.name}</p><p className="text-3xl font-bold mt-4 text-black">₹{qrPreview.sellPrice}</p></div>
                    </div>
                    <div className="flex gap-4 w-full max-w-lg"><Button className="flex-1" onClick={downloadQR}><Download className="w-4 h-4 mr-2" /> Download PNG</Button><Button variant="outline" className="flex-1" onClick={shareQR}><Share2 className="w-4 h-4 mr-2" /> Share</Button></div>
                </CardContent>
            </Card>
         </div>
      )}
    </div>
  );
}
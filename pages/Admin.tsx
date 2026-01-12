
import React, { useState, useEffect, useMemo, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import { Product } from '../types';
import { loadData, addProduct, updateProduct, deleteProduct, addCategory, deleteCategory } from '../services/storage';
import { Button, Input, Select, Card, CardContent, CardHeader, CardTitle, Label, Badge } from '../components/ui';
import { Plus, Trash2, Edit, Save, X, Search, QrCode, Download, Share2, AlertCircle, Tags, FileDown, Package, Coins, AlertTriangle, Layers, ScanBarcode } from 'lucide-react';

export default function Admin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Filters & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('name-asc');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const [barcodePreview, setBarcodePreview] = useState<Product | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    name: '', barcode: '', buyPrice: '', sellPrice: '', stock: '', description: '', category: '', hsn: ''
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [error, setError] = useState<string | null>(null);

  const refreshData = () => {
    const data = loadData();
    setProducts(data.products);
    setCategories(data.categories);
  };

  useEffect(() => {
    refreshData();

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = () => refreshData();
    window.addEventListener('storage', handleStorageChange);
    // Listen for local changes (same-tab sync)
    window.addEventListener('local-storage-update', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('local-storage-update', handleStorageChange);
    };
  }, []);

  // Barcode Generation Effect
  useEffect(() => {
    if (barcodePreview && barcodeCanvasRef.current) {
        try {
            JsBarcode(barcodeCanvasRef.current, barcodePreview.barcode, {
                format: "CODE128",
                displayValue: true, // This includes the barcode number
                fontSize: 20,
                width: 2,
                height: 100,
                margin: 10
            });
        } catch (e) {
            console.error("Barcode generation failed", e);
        }
    }
  }, [barcodePreview]);

  const handleSave = () => {
    // Strict Validation
    if (!formData.name || !formData.barcode || !formData.category || 
        formData.buyPrice === '' || formData.sellPrice === '' || formData.stock === '') {
        setError("Please fill in all required fields marked with *");
        return;
    }
    setError(null);

    const productPayload = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      image: formData.image || '', // Empty string if no image
      ...formData,
      buyPrice: Number(formData.buyPrice),
      sellPrice: Number(formData.sellPrice),
      stock: Number(formData.stock)
    } as Product;

    if (editingProduct) {
      const updated = updateProduct(productPayload);
      setProducts(updated);
    } else {
      const updated = addProduct(productPayload);
      setProducts(updated);
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this product?')) {
      const updated = deleteProduct(id);
      setProducts(updated);
    }
  };

  const handleAddCategory = () => {
      if(!newCategoryName.trim()) return;
      const updated = addCategory(newCategoryName.trim());
      setCategories(updated);
      setNewCategoryName('');
  };

  const handleDeleteCategory = (cat: string) => {
      if(window.confirm(`Delete category "${cat}"? Products with this category will not be deleted but may need updating.`)) {
          const updated = deleteCategory(cat);
          setCategories(updated);
      }
  };

  const openModal = (product?: Product) => {
    setError(null);
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ 
          name: '', 
          barcode: `GEN-${Math.floor(1000 + Math.random() * 9000)}`, 
          buyPrice: '', 
          sellPrice: '', 
          stock: '', 
          description: '', 
          category: '',
          hsn: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setError(null);
  };

  // --- IMAGE COMPRESSION LOGIC ---
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
          
          // Resize Logic: Max dimension 800px
          const MAX_SIZE = 800;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG 0.7 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setFormData((prev: any) => ({ ...prev, image: dataUrl }));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const getCompositeTag = (): HTMLCanvasElement | null => {
    if (!barcodeCanvasRef.current || !barcodePreview) return null;

    const barcodeCanvas = barcodeCanvasRef.current;
    const compositeCanvas = document.createElement("canvas");
    const ctx = compositeCanvas.getContext("2d");
    if (!ctx) return null;

    const padding = 20;
    const textHeight = 40;
    
    // Auto-calculate width based on barcode or a minimum for long names
    compositeCanvas.width = Math.max(barcodeCanvas.width + (padding * 2), 300);
    compositeCanvas.height = barcodeCanvas.height + textHeight + (padding * 2);

    // White background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    // Product Name (Centered at top)
    ctx.fillStyle = "black";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    const displayName = barcodePreview.name.length > 25 ? barcodePreview.name.substring(0, 22) + '...' : barcodePreview.name;
    ctx.fillText(displayName.toUpperCase(), compositeCanvas.width / 2, padding + 20);

    // Draw Barcode (Centered below name)
    const xOffset = (compositeCanvas.width - barcodeCanvas.width) / 2;
    ctx.drawImage(barcodeCanvas, xOffset, padding + textHeight);

    return compositeCanvas;
  }

  const downloadBarcode = () => {
    const composite = getCompositeTag();
    if (composite && barcodePreview) {
        const dataUrl = composite.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `${barcodePreview.barcode}-TAG.png`;
        downloadLink.href = dataUrl;
        downloadLink.click();
    }
  };

  const shareBarcode = async () => {
      const composite = getCompositeTag();
      if (composite && barcodePreview && navigator.share) {
          const dataUrl = composite.toDataURL("image/png");
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "barcode-tag.png", { type: "image/png" });
          try {
              await navigator.share({
                  title: `Barcode Tag for ${barcodePreview.name}`,
                  text: `Product: ${barcodePreview.name} | Code: ${barcodePreview.barcode}`,
                  files: [file]
              });
          } catch (e) {
              console.log("Share failed or cancelled", e);
          }
      } else {
          alert("Sharing not supported on this device/browser.");
      }
  };

  const filterCategories = useMemo(() => {
      return ['all', ...categories];
  }, [categories]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => 
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (categoryFilter === 'all' || p.category === categoryFilter)
    );

    result.sort((a, b) => {
      switch(sortOption) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'price-asc': return a.buyPrice - b.buyPrice; // Using Buy Price as requested
        case 'price-desc': return b.buyPrice - a.buyPrice;
        case 'stock-asc': return a.stock - b.stock;
        default: return 0;
      }
    });

    return result;
  }, [products, searchTerm, sortOption, categoryFilter]);

  // Calculate Dashboard Stats
  const stats = useMemo(() => {
      // Inventory Value based on Buy Price (Cost)
      const totalInventoryValue = products.reduce((acc, p) => acc + (p.stock * p.buyPrice), 0);
      const lowStockCount = products.filter(p => p.stock > 0 && p.stock < 5).length;
      const outOfStockCount = products.filter(p => p.stock === 0).length;
      
      return { totalInventoryValue, lowStockCount, outOfStockCount };
  }, [products]);

  const handleDownloadCategoryPDF = () => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Layout Configuration (Customer Catalog Style)
    const margin = 10;
    const cols = 3; 
    const colGap = 5;
    const rowGap = 5;
    const contentWidth = pageWidth - (margin * 2);
    const cardWidth = (contentWidth - ((cols - 1) * colGap)) / cols;
    const cardHeight = 60; // Compact height for customer catalog

    let x = margin;
    let y = 30; // Start Y after header

    // --- Header ---
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    const title = categoryFilter === 'all' ? "Customer Catalog - All Categories" : `Customer Catalog - ${categoryFilter}`;
    doc.text(title, pageWidth/2, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth/2, 22, { align: "center" });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 25, pageWidth - margin, 25);

    // --- Product Loop ---
    filteredProducts.forEach((product, index) => {
        // Check for Page Break
        if (y + cardHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }

        // --- Draw Card Container ---
        doc.setDrawColor(230, 230, 230); // Light gray border
        doc.setFillColor(255, 255, 255); // White background
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

        // --- Image ---
        const imgSize = 30; 
        const imgX = x + (cardWidth - imgSize) / 2;
        const imgY = y + 5;
        
        try {
            if (product.image && product.image.startsWith('data:image')) {
                doc.addImage(product.image, 'JPEG', imgX, imgY, imgSize, imgSize, undefined, 'FAST');
            } else {
                 // Placeholder
                 doc.setFillColor(245, 245, 245);
                 doc.rect(imgX, imgY, imgSize, imgSize, 'F');
                 doc.setFontSize(8);
                 doc.setTextColor(150, 150, 150);
                 doc.text("No Image", imgX + imgSize/2, imgY + imgSize/2, { align: "center" });
            }
        } catch (e) {
             doc.setFillColor(245, 245, 245);
             doc.rect(imgX, imgY, imgSize, imgSize, 'F');
        }

        // --- Text Content Base Y ---
        const textStartY = imgY + imgSize + 5; 
        
        // Product Name (Bold, Dark)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        // Truncate name if too long
        const titleLines = doc.splitTextToSize(product.name, cardWidth - 6);
        doc.text(titleLines[0], x + 3, textStartY);
        
        // Barcode (Gray, Smaller)
        const codeY = textStartY + 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(product.barcode, x + 3, codeY); 

        // --- Customer Mode Layout ---
        
        const priceY = codeY + 8; // 8mm below code line
        
        // Price
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Rs.${product.sellPrice}`, x + 3, priceY);
        
        // Stock Badge
        const inStock = product.stock > 0;
        const badgeText = inStock ? "In Stock" : "Out of Stock";
        const badgeWidth = doc.getTextWidth(badgeText) + 6;
        const badgeX = x + cardWidth - badgeWidth - 3;
        const badgeRectY = priceY - 5; 
        
        if (inStock) {
            doc.setFillColor(209, 250, 229);
            doc.setTextColor(6, 95, 70); 
        } else {
            doc.setFillColor(254, 226, 226);
            doc.setTextColor(185, 28, 28);
        }
        
        doc.roundedRect(badgeX, badgeRectY, badgeWidth, 7, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(badgeText, badgeX + 3, priceY);

        // --- Grid Logic ---
        x += cardWidth + colGap;
        
        if (index > 0 && (index + 1) % cols === 0) {
            x = margin;
            y += cardHeight + rowGap;
        }
    });
    
    doc.save(`customer-catalog-${categoryFilter}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20 md:pb-0">
      
      {/* 1. Header & Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full md:col-span-1 lg:col-span-2 space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Inventory</h1>
              <p className="text-muted-foreground">Manage your stock, products, and pricing.</p>
          </div>
          
          {/* Executive Stats Cards */}
          <Card className="bg-blue-50/50 border-blue-100 shadow-sm relative overflow-hidden group">
               <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
                   <div>
                       <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Inventory Value (Cost)</p>
                       <p className="text-2xl font-bold text-blue-900 mt-1">₹{stats.totalInventoryValue.toLocaleString()}</p>
                   </div>
                   <div className="absolute right-2 top-2 p-2 bg-blue-100 rounded-lg text-blue-600 opacity-50 group-hover:opacity-100 transition-opacity">
                       <Coins className="w-5 h-5" />
                   </div>
               </CardContent>
          </Card>

          <Card className="bg-amber-50/50 border-amber-100 shadow-sm relative overflow-hidden group">
               <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
                   <div>
                       <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Low Stock Alerts</p>
                       <div className="flex items-end gap-2 mt-1">
                           <p className="text-2xl font-bold text-amber-900">{stats.lowStockCount}</p>
                           {stats.outOfStockCount > 0 && (
                               <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                   {stats.outOfStockCount} Out
                               </span>
                           )}
                       </div>
                   </div>
                   <div className="absolute right-2 top-2 p-2 bg-amber-100 rounded-lg text-amber-600 opacity-50 group-hover:opacity-100 transition-opacity">
                       <AlertTriangle className="w-5 h-5" />
                   </div>
               </CardContent>
          </Card>
      </div>

      {/* 2. Control Tower Toolbar (Responsive Refactor) */}
      <div className="bg-card border rounded-xl p-3 shadow-sm sticky top-0 z-20 bg-opacity-95 backdrop-blur-md">
          <div className="flex flex-col md:flex-row gap-3">
              
              {/* Row 1: Search (Full width on mobile, Flex on Desktop) */}
              <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                  <Input 
                      placeholder="Search products..." 
                      className="pl-9 bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>

              {/* Row 2: Filters (2-col Grid on Mobile, Flex on Desktop) */}
              <div className="grid grid-cols-2 gap-2 md:flex md:w-auto">
                  <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full md:w-[140px]">
                      {filterCategories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
                  </Select>
                  <Select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="w-full md:w-[140px]">
                      <option value="name-asc">Name (A-Z)</option>
                      <option value="price-asc">Buy Price (Low-High)</option>
                      <option value="price-desc">Buy Price (High-Low)</option>
                      <option value="stock-asc">Stock (Low-High)</option>
                  </Select>
              </div>

              {/* Row 3: Actions (Flex row on Mobile, Flex on Desktop) */}
              <div className="flex items-center gap-2">
                   <div className="w-px h-9 bg-border mx-1 hidden md:block"></div>
                   
                   <Button variant="outline" size="icon" onClick={() => setIsCategoryModalOpen(true)} title="Manage Categories" className="shrink-0">
                       <Layers className="w-4 h-4" />
                   </Button>
                   <Button variant="outline" size="icon" onClick={handleDownloadCategoryPDF} title="Download Catalog" className="shrink-0">
                       <FileDown className="w-4 h-4" />
                   </Button>
                   
                   <Button onClick={() => openModal()} className="bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all flex-1 md:flex-none">
                       <Plus className="w-4 h-4 mr-2" /> <span className="md:inline">Add Product</span>
                   </Button>
              </div>
          </div>
      </div>

      {/* 3. Modern Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {filteredProducts.map(product => {
            const isOutOfStock = product.stock === 0;
            const isLowStock = product.stock > 0 && product.stock < 5;
            
            return (
              <Card key={product.id} className="group overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-muted/60">
                 {/* Image Area - SQUARE ASPECT RATIO */}
                 <div className="relative aspect-square w-full bg-gray-50 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                        <img src={product.image} alt={product.name} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                        <div className="text-center p-2 opacity-30">
                            <Package className="w-8 h-8 mx-auto mb-1" />
                            <p className="text-[9px] font-medium">No Image</p>
                        </div>
                    )}
                    
                    {/* Floating Status Badge */}
                    <div className="absolute top-2 right-2">
                        {isOutOfStock ? (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] shadow-sm">Out</Badge>
                        ) : isLowStock ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 h-5 px-1.5 text-[10px] shadow-sm hover:bg-amber-200">Low</Badge>
                        ) : (
                            <Badge variant="success" className="h-5 px-1.5 text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                {product.stock}
                            </Badge>
                        )}
                    </div>
                 </div>

                 <CardContent className="p-2 sm:p-3 relative bg-card">
                    <div className="mb-2">
                        {/* Title & Meta */}
                        <h3 className="font-semibold truncate text-[11px] sm:text-sm text-foreground leading-tight" title={product.name}>
                            {product.name}
                        </h3>
                        <div className="flex items-center gap-1 mt-1 text-[9px] sm:text-[10px] text-muted-foreground">
                            <span className="font-mono bg-muted px-1 rounded truncate max-w-[50%]">{product.barcode}</span>
                            <span className="truncate text-gray-400">|</span>
                            <span className="truncate text-blue-600 font-medium">{product.category}</span>
                        </div>
                        
                        {/* Price Row (Show BUY Price as requested) */}
                        <div className="flex items-end justify-between mt-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-muted-foreground leading-none">Cost</span>
                                <span className="font-bold text-sm sm:text-base text-primary">₹{product.buyPrice}</span>
                            </div>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground">Qty: {product.stock}</p>
                        </div>
                    </div>

                    {/* Action Bar (Reveals on Hover for Desktop, Always visible on Touch) */}
                    <div className="flex gap-1 justify-between pt-2 border-t border-dashed border-gray-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity delay-75">
                        <Button 
                            variant="ghost" size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-blue-50 hover:text-blue-600" 
                            onClick={(e) => { e.stopPropagation(); openModal(product); }}
                            title="Edit"
                        >
                            <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            variant="ghost" size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-purple-50 hover:text-purple-600" 
                            onClick={(e) => { e.stopPropagation(); setBarcodePreview(product); }}
                            title="Barcode"
                        >
                            <ScanBarcode className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            variant="ghost" size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-red-50 hover:text-red-600" 
                            onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                            title="Delete"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                 </CardContent>
              </Card>
            );
        })}
        
        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-muted rounded-xl bg-muted/5">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No products found</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                Try adjusting your search filters or add a new product to get started.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}>
                Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-muted/20">
                <CardTitle className="text-xl">{editingProduct ? 'Edit Product' : 'Add New Product'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={closeModal}><X className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
                {error && (
                    <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Product Name <span className="text-red-500">*</span></Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Wireless Mouse" />
                    </div>
                    <div className="space-y-2">
                        <Label>Barcode <span className="text-red-500">*</span></Label>
                        <Input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Scan or Type" />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>HSN Code</Label>
                    <Input value={formData.hsn} onChange={e => setFormData({...formData, hsn: e.target.value})} placeholder="Tax HSN Code" />
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pricing & Stock</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Buy Price</Label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-2.5 text-muted-foreground text-xs">₹</span>
                                <Input type="number" className="pl-6" value={formData.buyPrice} onChange={e => setFormData({...formData, buyPrice: e.target.value})} placeholder="0.00" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Sell Price</Label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-2.5 text-muted-foreground text-xs">₹</span>
                                <Input type="number" className="pl-6 font-bold text-primary" value={formData.sellPrice} onChange={e => setFormData({...formData, sellPrice: e.target.value})} placeholder="0.00" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Stock Qty</Label>
                            <Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} placeholder="0" />
                        </div>
                    </div>
                </div>
                
                <div className="space-y-2">
                     <Label>Product Image</Label>
                     <div className="flex items-center gap-4 p-3 border rounded-lg border-dashed hover:bg-muted/10 transition-colors">
                        <div className="h-16 w-16 bg-white rounded-md overflow-hidden border flex items-center justify-center shadow-sm">
                            {formData.image ? (
                                <img src={formData.image} alt="Preview" className="h-full w-full object-cover" /> 
                            ) : (
                                <span className="text-[10px] text-muted-foreground">No Image</span>
                            )}
                        </div>
                        <div className="flex-1">
                            {/* Updated Input for Image Handling */}
                            <Input type="file" accept="image/*" onChange={handleImageUpload} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
                        </div>
                     </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label>Category <span className="text-red-500">*</span></Label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary/80 px-2" onClick={() => setIsCategoryModalOpen(true)}>
                            + Manage
                        </Button>
                    </div>
                    <Select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        <option value="">Select Category</option>
                        {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional details..." />
                </div>
                
                <div className="pt-2">
                    <Button className="w-full h-11 text-base shadow-lg" onClick={handleSave}>
                        <Save className="w-4 h-4 mr-2" /> {editingProduct ? 'Update Product' : 'Save Product'}
                    </Button>
                </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
             <Card className="w-full max-w-sm animate-in fade-in zoom-in duration-200 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-muted/20">
                    <CardTitle className="text-lg">Manage Categories</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setIsCategoryModalOpen(false)}><X className="w-4 h-4" /></Button>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                    <div className="flex gap-2">
                        <Input 
                            value={newCategoryName} 
                            onChange={e => setNewCategoryName(e.target.value)} 
                            placeholder="New Category Name" 
                        />
                        <Button onClick={handleAddCategory}>Add</Button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                        {categories.length === 0 && <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center"><Tags className="w-8 h-8 opacity-20 mb-2"/>No categories yet.</div>}
                        {categories.map(cat => (
                            <div key={cat} className="flex justify-between items-center p-3 bg-card hover:bg-muted/50 transition-colors rounded-lg border shadow-sm group">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    {cat}
                                </span>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteCategory(cat)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
             </Card>
          </div>
      )}

      {/* Barcode Preview Modal */}
      {barcodePreview && (
         <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl bg-white text-black overflow-hidden animate-in fade-in zoom-in duration-200">
                <CardHeader className="flex flex-row justify-between items-center border-b">
                    <CardTitle>Product Barcode Tag</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setBarcodePreview(null)}><X className="w-4 h-4" /></Button>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center gap-6">
                    <div className="flex flex-col items-center border-4 border-black p-6 rounded-xl bg-white shadow-2xl w-full max-w-lg">
                         <p className="text-3xl font-extrabold text-black mb-5 text-center leading-tight uppercase">{barcodePreview.name}</p>
                         <div className="bg-white p-2 border-y border-gray-100 w-full flex justify-center py-6">
                             <canvas ref={barcodeCanvasRef} />
                         </div>
                         <p className="text-sm font-bold mt-4 text-gray-400 tracking-[0.2em] uppercase">Inventory Management</p>
                    </div>

                    <div className="flex gap-4 w-full max-w-lg">
                        <Button className="flex-1" onClick={downloadBarcode}>
                            <Download className="w-4 h-4 mr-2" /> Download Tag
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={shareBarcode}>
                            <Share2 className="w-4 h-4 mr-2" /> Share Tag
                        </Button>
                    </div>
                </CardContent>
            </Card>
         </div>
      )}
    </div>
  );
}


import React from 'react';
import jsPDF from 'jspdf';
import { useStockFlow } from '../services/storage';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '../components/ui';
import { FileText, Download, User, Users, AlertCircle } from 'lucide-react';

export default function Reports() {
  const { products, profile } = useStockFlow();

  const generatePDF = (reportType: 'internal' | 'customer') => {
    if (products.length === 0) return;

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Layout Configuration
    const margin = 10;
    const cols = 3; 
    const colGap = 5;
    const rowGap = 5;
    const contentWidth = pageWidth - (margin * 2);
    const cardWidth = (contentWidth - ((cols - 1) * colGap)) / cols;
    const cardHeight = reportType === 'internal' ? 70 : 60; 

    let x = margin;
    let y = 30; // Start Y after header

    // --- Header ---
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    const title = reportType === 'internal' ? "Internal Audit Report" : "Customer Catalog";
    doc.text(title, pageWidth/2, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`${profile.storeName} | Generated: ${new Date().toLocaleString()}`, pageWidth/2, 22, { align: "center" });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 25, pageWidth - margin, 25);

    products.forEach((product, index) => {
        if (y + cardHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }

        doc.setDrawColor(230, 230, 230);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

        const imgSize = 30; 
        const imgX = x + (cardWidth - imgSize) / 2;
        const imgY = y + 5;
        
        try {
            if (product.image && product.image.startsWith('data:image')) {
                doc.addImage(product.image, 'JPEG', imgX, imgY, imgSize, imgSize, undefined, 'FAST');
            } else {
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

        const textStartY = imgY + imgSize + 5; 
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        const titleLines = doc.splitTextToSize(product.name, cardWidth - 6);
        doc.text(titleLines[0], x + 3, textStartY);
        
        const skuY = textStartY + 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(product.sku, x + 3, skuY); 

        if (reportType === 'customer') {
            const priceY = skuY + 8;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Rs.${product.sellPrice}`, x + 3, priceY);
            
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
        } else {
            const stockY = skuY + 5; 
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            doc.text(`Stock: ${product.stock}`, x + 3, stockY);
            
            const buyY = stockY + 5;
            doc.setFontSize(9);
            doc.setTextColor(50, 50, 50);
            doc.text(`Buy: Rs.${product.buyPrice}`, x + 3, buyY);
            
            const footerY = y + cardHeight - 5;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text(`Sell: Rs.${product.sellPrice}`, x + 3, footerY);

            const margin = product.sellPrice - product.buyPrice;
            const marginX = x + cardWidth - 3;
            doc.setFont("helvetica", "bold");
            if (margin >= 0) doc.setTextColor(21, 128, 61);
            else doc.setTextColor(185, 28, 28);
            doc.text(`M: ${margin.toFixed(0)}`, marginX, footerY, { align: "right" });
        }

        x += cardWidth + colGap;
        if (index > 0 && (index + 1) % cols === 0) {
            x = margin;
            y += cardHeight + rowGap;
        }
    });
    
    doc.save(`stockflow-${reportType}-report.pdf`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Generate PDF documents for internal use or customers.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => generatePDF('internal')}>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                        <User className="w-6 h-6" />
                    </div>
                    Internal Audit Report
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">
                    Detailed stock list including purchase prices, margins, and exact stock counts. Strictly for internal management use.
                </p>
                {products.length === 0 ? (
                    <div className="bg-muted p-3 rounded-lg text-xs flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="w-4 h-4" /> No data available
                    </div>
                ) : (
                    <Button className="w-full" variant="outline">
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                    </Button>
                )}
            </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => generatePDF('customer')}>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 text-purple-700 rounded-lg">
                        <Users className="w-6 h-6" />
                    </div>
                    Customer Catalog
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">
                    A clean, presentable list of products with images, selling prices, and availability status. Hide sensitive cost data.
                </p>
                {products.length === 0 ? (
                    <div className="bg-muted p-3 rounded-lg text-xs flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="w-4 h-4" /> No data available
                    </div>
                ) : (
                    <Button className="w-full" variant="outline">
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                    </Button>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

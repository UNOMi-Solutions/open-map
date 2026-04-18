import React, { useState } from 'react';
import { X, Copy, Download, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';

interface SharePopupProps {
  isOpen: boolean;
  onClose: () => void;
  mapContainerRef?: React.RefObject<HTMLElement | null>;
}

export default function SharePopup({ isOpen, onClose, mapContainerRef }: SharePopupProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleDownloadPDF = async () => {
    if (!mapContainerRef?.current) {
      console.error('Map container not found');
      return;
    }

    setDownloading(true);
    try {
      // Find the map container - look for the Leaflet map container within the section
      const mapElement = mapContainerRef.current.querySelector('.leaflet-container') as HTMLElement;
      
      if (!mapElement) {
        console.error('Map element not found');
        setDownloading(false);
        return;
      }

      // Wait a bit for any map tiles to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the map as canvas
      const canvas = await html2canvas(mapElement, {
        backgroundColor: '#0b2233',
        useCORS: true,
        allowTaint: true,
        scale: 2, // Higher quality
        logging: false,
        width: mapElement.offsetWidth,
        height: mapElement.offsetHeight,
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // If image is taller than page, scale it down
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      if (imgHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = (canvas.width * pdfHeight) / canvas.height;
      }

      pdf.addImage(imgData, 'PNG', (pdfWidth - finalWidth) / 2, (pdfHeight - finalHeight) / 2, finalWidth, finalHeight);
      pdf.save('openmap-export.pdf');
      
      setDownloading(false);
      onClose();
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999]">
      {/* Dark background overlay */}
      <div 
        className="absolute inset-0 bg-black/76"
        onClick={onClose}
      />
      
      {/* Share Modal */}
      <div 
        className="relative bg-[#06012A] rounded-3xl p-8 w-full max-w-md mx-4"
        style={{
          borderRadius: '32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="flex flex-col gap-6">
          <h2 className="text-white text-2xl font-semibold text-center">
            Share Map
          </h2>

          {/* Copy Link Option */}
          <Button
            onClick={handleCopyLink}
            className="w-full h-14 bg-[#1ea7ff] hover:bg-[#1296ea] text-white font-semibold rounded-lg flex items-center justify-center gap-3 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                <span>Copy Link</span>
              </>
            )}
          </Button>

          {/* Download PDF Option */}
          <Button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="w-full h-14 bg-white hover:bg-gray-100 text-[#070614] font-semibold rounded-lg flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <div className="w-5 h-5 border-2 border-[#070614] border-t-transparent rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download PDF</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


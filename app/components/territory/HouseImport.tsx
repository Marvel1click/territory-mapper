'use client';

import { useState, useCallback } from 'react';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { cn } from '@/app/lib/utils';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2,
  X,
  Loader2,
  MapPin
} from 'lucide-react';

interface HouseImportProps {
  territoryId: string;
  onImport?: (houses: ParsedHouse[]) => void;
  className?: string;
}

interface ParsedHouse {
  address: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  isDnc?: boolean;
}

// TerritoryId reserved for future use (association validation)
export function HouseImport({ territoryId: _territoryId, onImport, className }: HouseImportProps) {
  const { triggerHaptic, hapticPatterns } = useAccessibility();
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedHouses, setParsedHouses] = useState<ParsedHouse[]>([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const handleFile = useCallback((file: File) => {
    setError('');
    setIsParsing(true);

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const houses = parseCSV(content);
        setParsedHouses(houses);
        setShowModal(true);
        triggerHaptic(hapticPatterns.success);
      } catch {
        setError('Failed to parse CSV file. Please check the format.');
        triggerHaptic(hapticPatterns.error);
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file.');
      setIsParsing(false);
      triggerHaptic(hapticPatterns.error);
    };

    reader.readAsText(file);
  }, [triggerHaptic, hapticPatterns]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const parseCSV = (content: string): ParsedHouse[] => {
    const lines = content.split('\n').filter(line => line.trim());
    const houses: ParsedHouse[] = [];

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('address') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles basic comma separation)
      const columns = line.split(',').map(col => col.trim());
      
      const address = columns[0];
      if (!address) continue;

      const house: ParsedHouse = { address };

      // Try to parse lat/lng if provided
      if (columns[1] && columns[2]) {
        const lat = parseFloat(columns[1]);
        const lng = parseFloat(columns[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          house.latitude = lat;
          house.longitude = lng;
        }
      }

      // Notes column
      if (columns[3]) {
        house.notes = columns[3];
      }

      // DNC flag
      if (columns[4]?.toLowerCase() === 'true' || columns[4]?.toLowerCase() === 'yes' || columns[4]?.toLowerCase() === 'dnc') {
        house.isDnc = true;
      }

      houses.push(house);
    }

    return houses;
  };

  const handleConfirmImport = () => {
    onImport?.(parsedHouses);
    setShowModal(false);
    setParsedHouses([]);
    triggerHaptic(hapticPatterns.success);
  };

  const handleClose = () => {
    setShowModal(false);
    setParsedHouses([]);
    setError('');
  };

  return (
    <>
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          className
        )}
      >
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center gap-3">
          {isParsing ? (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-muted-foreground">Parsing file...</p>
            </>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-full">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Drop CSV file here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports: address, latitude, longitude, notes, DNC
                </p>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-xl font-bold">Import Preview</h3>
                <p className="text-sm text-muted-foreground">
                  {parsedHouses.length} addresses ready to import
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {parsedHouses.slice(0, 20).map((house, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                  >
                    <div className="p-1.5 bg-primary/10 rounded">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{house.address}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {house.latitude && house.longitude && (
                          <span>
                            {house.latitude.toFixed(4)}, {house.longitude.toFixed(4)}
                          </span>
                        )}
                        {house.isDnc && (
                          <span className="text-destructive font-medium">DNC</span>
                        )}
                      </div>
                      {house.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {house.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {parsedHouses.length > 20 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    ...and {parsedHouses.length - 20} more
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                <span>CSV Import</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Import {parsedHouses.length} Houses
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

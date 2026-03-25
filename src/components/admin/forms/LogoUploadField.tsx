import { useState, useRef, useCallback } from 'react';
import { Upload, X, Link2, Image, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LogoUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  organizationId: string;
  label?: string;
  className?: string;
}

type InputMode = 'upload' | 'url';

export function LogoUploadField({
  value,
  onChange,
  organizationId,
  label = 'Organization Logo',
  className,
}: LogoUploadFieldProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inputMode, setInputMode] = useState<InputMode>(value?.startsWith('http') ? 'url' : 'upload');
  const [urlInput, setUrlInput] = useState(value || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (PNG, JPG, SVG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setPreviewError(false);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${organizationId}/logo-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('organization-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('organization-logos')
        .getPublicUrl(data.path);

      const publicUrl = publicUrlData.publicUrl;
      onChange(publicUrl);
      setUrlInput(publicUrl);
      
      toast({
        title: 'Logo uploaded',
        description: 'The logo has been uploaded successfully',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [organizationId, onChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUrlSubmit = useCallback(() => {
    const trimmedUrl = urlInput.trim();
    if (trimmedUrl && trimmedUrl !== value) {
      setPreviewError(false);
      onChange(trimmedUrl);
    }
  }, [urlInput, value, onChange]);

  const handleClear = useCallback(() => {
    onChange('');
    setUrlInput('');
    setPreviewError(false);
  }, [onChange]);

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Label */}
      <label className="block text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
        {label}
      </label>

      <div className="flex gap-4">
        {/* Preview */}
        <div className="w-24 h-24 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))] flex-shrink-0 overflow-hidden flex items-center justify-center">
          {value && !previewError ? (
            <img
              src={value}
              alt="Logo preview"
              className="w-full h-full object-contain"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <Image className="w-8 h-8 text-[hsl(var(--portal-text-muted))]" />
          )}
        </div>

        {/* Upload / URL Section */}
        <div className="flex-1 space-y-3">
          {/* Mode Toggle */}
          <div className="inline-flex rounded-lg bg-[hsl(var(--portal-bg-tertiary))] p-1 border border-[hsl(var(--portal-border))]">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                inputMode === 'upload'
                  ? 'bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-primary))] shadow-sm'
                  : 'text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))]'
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setInputMode('url')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                inputMode === 'url'
                  ? 'bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-primary))] shadow-sm'
                  : 'text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))]'
              )}
            >
              <Link2 className="w-3.5 h-3.5" />
              URL
            </button>
          </div>

          {/* Upload Mode */}
          {inputMode === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.05)]'
                  : 'border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-accent-blue)/0.5)] hover:bg-[hsl(var(--portal-bg-tertiary))]',
                isUploading && 'pointer-events-none opacity-60'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              {isUploading ? (
                <div className="flex items-center justify-center gap-2 text-[hsl(var(--portal-text-muted))]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-6 h-6 mx-auto text-[hsl(var(--portal-text-muted))]" />
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                    PNG, JPG, SVG up to 5MB
                  </p>
                </div>
              )}
            </div>
          )}

          {/* URL Mode */}
          {inputMode === 'url' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onBlur={handleUrlSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  placeholder="https://example.com/logo.png"
                  className={cn(
                    'flex-1 h-10 px-3 rounded-lg border text-sm transition-all',
                    'bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]',
                    'text-[hsl(var(--portal-text-primary))] placeholder:text-[hsl(var(--portal-text-muted))]',
                    'focus:outline-none focus:border-[hsl(var(--portal-accent-blue))] focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.2)]',
                    !isValidUrl(urlInput) && 'border-[hsl(var(--portal-error))]'
                  )}
                />
              </div>
              {urlInput && !isValidUrl(urlInput) && (
                <p className="text-xs text-[hsl(var(--portal-error))]">
                  Please enter a valid URL
                </p>
              )}
            </div>
          )}

          {/* Clear Button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))] flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Remove logo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

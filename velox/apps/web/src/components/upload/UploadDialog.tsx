import { useState, useRef, useCallback } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUploadUrl, useCreateVideo } from '@/hooks/use-videos';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  folderId?: string;
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'creating' | 'done' | 'error';
  error?: string;
}

export function UploadDialog({ open, onClose, folderId }: UploadDialogProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getUploadUrl = useUploadUrl();
  const createVideo = useCreateVideo();

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles: UploadFile[] = Array.from(selectedFiles).map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    if (!title && selectedFiles.length === 1) {
      setTitle(selectedFiles[0].name.replace(/\.[^.]+$/, ''));
    }
  }, [title]);

  const handleUpload = async () => {
    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status !== 'pending') continue;

      try {
        // Update status to uploading
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

        // Get presigned URL
        const urlResult = await getUploadUrl.mutateAsync({
          filename: entry.file.name,
          contentType: entry.file.type || 'video/mp4',
        });
        const { uploadUrl, s3Key } = urlResult.data!;

        // Upload to S3 with progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, progress } : f));
            }
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          });
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', entry.file.type || 'video/mp4');
          xhr.send(entry.file);
        });

        // Create video record
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'creating', progress: 100 } : f));

        const videoTitle = files.length === 1 ? (title || entry.file.name) : entry.file.name.replace(/\.[^.]+$/, '');

        await createVideo.mutateAsync({
          title: videoTitle,
          sourceS3Key: s3Key,
          folderId,
        });

        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'done' } : f));
      } catch (err) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: (err as Error).message } : f
          )
        );
      }
    }
  };

  const allDone = files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'error');
  const isUploading = files.some((f) => f.status === 'uploading' || f.status === 'creating');

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-velox-surface border border-velox-border rounded-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-velox-border">
          <h2 className="text-lg font-semibold">Upload Videos</h2>
          <button
            onClick={onClose}
            className="text-velox-text-muted hover:text-velox-text-primary transition-colors"
            disabled={isUploading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {files.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-velox-border-light rounded-xl p-10 text-center hover:border-velox-accent transition-colors"
            >
              <Upload className="w-10 h-10 text-velox-text-muted mx-auto mb-3" />
              <p className="text-sm text-velox-text-secondary">
                Click to select files or drag & drop
              </p>
              <p className="text-xs text-velox-text-muted mt-1">
                MP4, MOV, MXF, MTS, AVI
              </p>
            </button>
          ) : (
            <>
              {files.length === 1 && files[0].status === 'pending' && (
                <div>
                  <label className="block text-xs font-mono text-velox-text-muted mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
                    placeholder="Video title..."
                  />
                </div>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {files.map((entry, idx) => (
                  <div
                    key={idx}
                    className="bg-velox-bg rounded-lg p-3 border border-velox-border"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium truncate flex-1">
                        {entry.file.name}
                      </span>
                      <span className="shrink-0 ml-2">
                        {entry.status === 'done' && <CheckCircle className="w-4 h-4 text-velox-green" />}
                        {entry.status === 'error' && <AlertCircle className="w-4 h-4 text-velox-red" />}
                        {(entry.status === 'uploading' || entry.status === 'creating') && (
                          <Loader2 className="w-4 h-4 text-velox-accent animate-spin" />
                        )}
                      </span>
                    </div>
                    {(entry.status === 'uploading' || entry.status === 'creating') && (
                      <div className="w-full h-1.5 bg-velox-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-velox-accent transition-all duration-300 rounded-full"
                          style={{ width: `${entry.progress}%` }}
                        />
                      </div>
                    )}
                    {entry.status === 'creating' && (
                      <p className="text-[10px] text-velox-text-muted mt-1">Creating video record...</p>
                    )}
                    {entry.error && (
                      <p className="text-[10px] text-velox-red mt-1">{entry.error}</p>
                    )}
                  </div>
                ))}
              </div>

              {!isUploading && !allDone && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-velox-accent hover:underline"
                >
                  + Add more files
                </button>
              )}
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mp4,.mov,.mxf,.mts,.avi"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-velox-border">
          {allDone ? (
            <button
              onClick={() => { setFiles([]); setTitle(''); onClose(); }}
              className="px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2 text-sm text-velox-text-secondary hover:text-velox-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || isUploading}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  files.length > 0 && !isUploading
                    ? 'bg-velox-accent text-velox-bg hover:bg-velox-accent-hover'
                    : 'bg-velox-border text-velox-text-muted cursor-not-allowed'
                )}
              >
                {isUploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

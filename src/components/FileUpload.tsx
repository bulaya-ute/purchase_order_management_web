import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { uploadFile } from '../api/filesApi';
import type { UploadedFile } from '../api/filesApi';
import { getErrorMessage } from '../api/errorMessage';

interface FileUploadProps {
  /** Called with the uploaded file's id + url once the upload succeeds. */
  onUploaded: (file: UploadedFile) => void;
  /** Called when the user picks a different file or clears the selection, before/instead of a successful upload. */
  onClear?: () => void;
  disabled?: boolean;
  accept?: string;
  label?: string;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generic controlled file picker: choose a file, upload it immediately via POST /api/files, and
 * surface the resulting API-resolved URL. Reused wherever a file attachment is needed (e.g.
 * quotation capture) — the parent owns what the uploaded file means; this component only owns
 * the picking/uploading mechanics.
 */
export function FileUpload({ onUploaded, onClear, disabled = false, accept, label = 'Attach file' }: FileUploadProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedName(file.name);
    setSelectedSize(file.size);
    setUploaded(null);
    setError(null);
    onClear?.();

    setIsUploading(true);
    try {
      const result = await uploadFile(file);
      setUploaded(result);
      onUploaded(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload file.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <input
        type="file"
        accept={accept}
        disabled={disabled || isUploading}
        onChange={(e) => void handleChange(e)}
        aria-label={label}
      />

      {isUploading && <span className="file-upload-status">Uploading…</span>}

      {!isUploading && selectedName && (
        <div className="file-upload-info">
          <span>
            {selectedName}
            {selectedSize != null ? ` (${formatBytes(selectedSize)})` : ''}
          </span>
          {uploaded && (
            <a href={uploaded.url} target="_blank" rel="noreferrer">
              View
            </a>
          )}
        </div>
      )}

      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

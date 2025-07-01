import React, { useCallback, useState } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  language: 'ar' | 'en';
  onFileUpload: (file: File) => void;
  uploadedFile: File | null;
  onRemoveFile: () => void;
}

export default function FileUpload({ language, onFileUpload, uploadedFile, onRemoveFile }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError('');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    if (file.size > maxSize) {
      setError(language === 'ar' ? 'حجم الملف يجب أن يكون أقل من 5 ميجابايت' : 'File size must be less than 5MB');
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      setError(language === 'ar' ? 'يرجى رفع ملف PDF أو DOCX فقط' : 'Please upload PDF or DOCX files only');
      return;
    }

    onFileUpload(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return language === 'ar' ? '0 بايت' : '0 Bytes';
    const k = 1024;
    const sizes = language === 'ar' 
      ? ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت']
      : ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className={`text-xl font-bold text-gray-800 mb-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        {language === 'ar' ? '1. رفع الوثيقة للتحليل' : '1. Upload Document for Analysis'}
      </h2>

      {!uploadedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            {language === 'ar' 
              ? 'اسحب وأفلت الملف هنا أو انقر للتحديد'
              : 'Drag and drop your file here or click to select'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {language === 'ar' 
              ? 'ملفات PDF أو DOCX (حد أقصى 5 ميجابايت)'
              : 'PDF or DOCX files (Max 5MB)'}
          </p>
          <p className="text-xs text-blue-600 mb-4">
            {language === 'ar' 
              ? 'يدعم الوثائق العربية والإنجليزية'
              : 'Supports Arabic and English documents'}
          </p>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors ${language === 'ar' ? 'space-x-reverse' : ''}`}
          >
            <Upload className="w-4 h-4" />
            <span>{language === 'ar' ? 'اختر ملف' : 'Choose File'}</span>
          </label>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center space-x-3 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
              <File className="w-8 h-8 text-blue-600" />
              <div>
                <p className={`font-medium text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {uploadedFile.name}
                </p>
                <p className={`text-sm text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {formatFileSize(uploadedFile.size)}
                </p>
              </div>
            </div>
            <button
              onClick={onRemoveFile}
              className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
              title={language === 'ar' ? 'إزالة الملف' : 'Remove file'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className={`mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={`text-red-700 text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
import React, { useState, useCallback } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, XCircle, Brain, Loader, Users, FileText, Eye } from 'lucide-react';
import { langchainService } from '../services/langchainService';

interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
  documentContent?: string;
}

interface CriteriaUploadBoxProps {
  language: 'ar' | 'en';
  criteriaId: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  onAnalysisComplete: (criteriaId: string, analysis: CriteriaAnalysis) => void;
}

export default function CriteriaUploadBox({
  language,
  criteriaId,
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  onAnalysisComplete
}: CriteriaUploadBoxProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CriteriaAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isUsingOCR, setIsUsingOCR] = useState(false);

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

    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    const maxSize = 10 * 1024 * 1024; // Increased to 10MB for image files
    const allowedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ];

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        setError(language === 'ar' ? 'حجم الملف يجب أن يكون أقل من 10 ميجابايت' : 'File size must be less than 10MB');
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        setError(language === 'ar' ? 'يرجى رفع ملفات PDF أو DOCX أو TXT أو صور فقط' : 'Please upload PDF, DOCX, TXT, or image files only');
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
      analyzeFiles([...uploadedFiles, ...validFiles]);
    }
  };

  const analyzeFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    setError('');
    setOcrProgress(0);
    setIsUsingOCR(false);
    setAnalysisProgress(language === 'ar' ? 'بدء التحليل...' : 'Starting analysis...');

    try {
      const primaryFile = files[0];
      
      // Check if it's an image file
      if (primaryFile.type.startsWith('image/')) {
        setIsUsingOCR(true);
        setAnalysisProgress(language === 'ar' ? 'تحليل الصورة باستخدام تقنية التعرف الضوئي على الحروف...' : 'Analyzing image using OCR technology...');
      } else if (primaryFile.type === 'application/pdf') {
        setAnalysisProgress(language === 'ar' ? 'استخراج النص من PDF (قد يتطلب OCR للمستندات الممسوحة ضوئياً)...' : 'Extracting text from PDF (may require OCR for scanned documents)...');
      } else {
        setAnalysisProgress(language === 'ar' ? 'تحليل الوثيقة بواسطة الوكلاء الذكيين...' : 'Analyzing document with smart agents...');
      }

      console.log(`Starting analysis for criteria ${criteriaId} with file:`, primaryFile.name);
      
      const result = await langchainService.analyzeCriteria(primaryFile, criteriaId, language);
      
      console.log(`Analysis completed for criteria ${criteriaId}:`, result);
      
      const analysis: CriteriaAnalysis = {
        score: result.score,
        status: result.status,
        confidence: result.confidence,
        evidence: result.evidence.map(e => e.text),
        findings: result.findings,
        recommendations: result.recommendations,
        documentContent: result.documentContent
      };

      setAnalysis(analysis);
      onAnalysisComplete(criteriaId, analysis);
      setAnalysisProgress(language === 'ar' ? 'اكتمل التحليل بنجاح!' : 'Analysis completed successfully!');

    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 
        (language === 'ar' 
          ? 'حدث خطأ أثناء تحليل الملفات'
          : 'An error occurred while analyzing the files');
      
      setError(errorMessage);
      setAnalysisProgress('');
      
      if (errorMessage.includes('OCR')) {
        setError(language === 'ar' 
          ? 'فشل في تحليل الصورة بتقنية OCR. يرجى التأكد من وضوح النص في الصورة.'
          : 'OCR analysis failed. Please ensure the text in the image is clear and readable.');
      } else if (errorMessage.includes('API key')) {
        setError(language === 'ar' 
          ? 'مفتاح OpenAI API غير صحيح أو غير موجود. يرجى التحقق من الإعدادات.'
          : 'OpenAI API key is invalid or missing. Please check your configuration.');
      }
    } finally {
      setIsAnalyzing(false);
      setIsUsingOCR(false);
      setOcrProgress(0);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setAnalysis(null);
      setError('');
      setAnalysisProgress('');
    } else {
      analyzeFiles(newFiles);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'border-green-500 bg-green-50';
      case 'fail':
        return 'border-red-500 bg-red-50';
      case 'partial':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
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

  const getFileTypeIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Eye className="w-5 h-5 text-purple-600" />;
    }
    return <File className="w-5 h-5 text-blue-600" />;
  };

  return (
    <div className={`border-2 rounded-lg p-4 transition-all ${
      analysis ? getStatusColor(analysis.status) : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className={`flex items-start justify-between mb-4 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
        <div className="flex-1">
          <h3 className={`font-semibold text-gray-800 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? titleAr : titleEn}
          </h3>
          <p className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right leading-relaxed' : 'text-left'}`}>
            {language === 'ar' ? descriptionAr : descriptionEn}
          </p>
        </div>
        
        {analysis && (
          <div className={`flex items-center space-x-2 ml-4 ${language === 'ar' ? 'space-x-reverse mr-4 ml-0' : ''}`}>
            {getStatusIcon(analysis.status)}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{analysis.score}%</div>
              <div className="text-xs text-gray-500">
                {language === 'ar' ? 'النتيجة' : 'Score'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Area */}
      {uploadedFiles.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            {language === 'ar' 
              ? 'اسحب وأفلت الملفات هنا أو انقر للتحديد'
              : 'Drag and drop files here or click to select'}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            {language === 'ar' 
              ? 'ملفات PDF أو DOCX أو TXT أو صور (حد أقصى 10 ميجابايت لكل ملف)'
              : 'PDF, DOCX, TXT, or image files (Max 10MB each)'}
          </p>
          <p className="text-xs text-blue-600 mb-3">
            {language === 'ar' 
              ? 'يدعم الوثائق العربية والإنجليزية + تقنية OCR للصور والمستندات الممسوحة ضوئياً'
              : 'Supports Arabic and English documents + OCR for images and scanned documents'}
          </p>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.tiff,.bmp"
            onChange={handleFileInput}
            className="hidden"
            id={`file-upload-${criteriaId}`}
            multiple
          />
          <label
            htmlFor={`file-upload-${criteriaId}`}
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors text-sm ${language === 'ar' ? 'space-x-reverse' : ''}`}
          >
            <Upload className="w-4 h-4" />
            <span>{language === 'ar' ? 'اختر ملفات' : 'Choose Files'}</span>
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Uploaded Files */}
          {uploadedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div className={`flex items-center space-x-3 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
                {getFileTypeIcon(file)}
                <div>
                  <p className={`text-sm font-medium text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {file.name}
                  </p>
                  <p className={`text-xs text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {formatFileSize(file.size)}
                    {file.type.startsWith('image/') && (
                      <span className="ml-2 text-purple-600">
                        {language === 'ar' ? '(صورة - سيتم استخدام OCR)' : '(Image - OCR will be used)'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                title={language === 'ar' ? 'إزالة الملف' : 'Remove file'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add More Files Button */}
          <div className="text-center pt-2">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.tiff,.bmp"
              onChange={handleFileInput}
              className="hidden"
              id={`file-upload-more-${criteriaId}`}
              multiple
            />
            <label
              htmlFor={`file-upload-more-${criteriaId}`}
              className={`text-blue-600 hover:text-blue-700 cursor-pointer inline-flex items-center space-x-1 text-sm ${language === 'ar' ? 'space-x-reverse' : ''}`}
            >
              <Upload className="w-4 h-4" />
              <span>{language === 'ar' ? 'إضافة ملفات أخرى' : 'Add More Files'}</span>
            </label>
          </div>
        </div>
      )}

      {/* Analysis Status */}
      {isAnalyzing && (
        <div className={`mt-4 p-3 bg-blue-50 rounded-lg flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
          <div className="flex items-center space-x-2">
            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
            {isUsingOCR && <Eye className="w-4 h-4 text-purple-600" />}
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <span className="text-blue-700 text-sm font-medium">
              {isUsingOCR 
                ? (language === 'ar' ? 'تحليل OCR + وكلاء ذكيين' : 'OCR Analysis + Smart Agents')
                : (language === 'ar' ? 'تحليل متعدد الوكلاء' : 'Multi-Agent Analysis')
              }
            </span>
            <p className="text-xs text-blue-600 mt-1">{analysisProgress}</p>
            {isUsingOCR && ocrProgress > 0 && (
              <div className="w-full bg-blue-200 rounded-full h-1 mt-1">
                <div 
                  className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !isAnalyzing && (
        <div className="mt-4 space-y-3">
          {/* Multi-Agent Badge */}
          <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-purple-600 font-medium">
              {language === 'ar' ? 'تحليل بواسطة الوكلاء الذكيين' : 'Multi-Agent Analysis'}
            </span>
            {uploadedFiles.some(f => f.type.startsWith('image/')) && (
              <>
                <span className="text-xs text-gray-400">+</span>
                <Eye className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-purple-600 font-medium">OCR</span>
              </>
            )}
          </div>

          {/* Confidence Score */}
          <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm text-gray-600">
              {language === 'ar' ? 'ثقة النظام:' : 'System Confidence:'}
            </span>
            <div className={`flex items-center space-x-1 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-600">{analysis.confidence}%</span>
            </div>
          </div>

          {/* Document Content Found */}
          {analysis.documentContent && (
            <div>
              <h4 className={`text-sm font-medium text-gray-700 mb-1 flex items-center ${language === 'ar' ? 'text-right flex-row-reverse' : 'text-left'}`}>
                <FileText className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                {language === 'ar' ? 'المحتوى الموجود في الوثيقة:' : 'Content Found in Document:'}
              </h4>
              <div className={`bg-gray-100 border-l-4 border-blue-400 p-3 rounded text-sm text-gray-700 ${language === 'ar' ? 'border-l-0 border-r-4 text-right' : 'text-left'}`}>
                {analysis.documentContent}
              </div>
            </div>
          )}

          {/* Findings */}
          <div>
            <h4 className={`text-sm font-medium text-gray-700 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'نتائج التحليل:' : 'Analysis Results:'}
            </h4>
            <p className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right leading-relaxed' : 'text-left'}`}>
              {analysis.findings}
            </p>
          </div>

          {/* Evidence */}
          {analysis.evidence && analysis.evidence.length > 0 && (
            <div>
              <h4 className={`text-sm font-medium text-gray-700 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'الأدلة:' : 'Evidence:'}
              </h4>
              <div className="space-y-1">
                {analysis.evidence.slice(0, 2).map((evidence, index) => (
                  <div key={index} className={`bg-white border-l-4 border-blue-400 p-2 rounded text-xs text-gray-600 italic ${language === 'ar' ? 'border-l-0 border-r-4 text-right' : 'text-left'}`}>
                    "{evidence}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Recommendation */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div>
              <h4 className={`text-sm font-medium text-gray-700 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'التوصية الرئيسية:' : 'Key Recommendation:'}
              </h4>
              <p className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right leading-relaxed' : 'text-left'}`}>
                {analysis.recommendations[0]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
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
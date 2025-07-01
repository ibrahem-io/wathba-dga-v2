import React, { useState, useCallback } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, XCircle, Brain, Loader, Users, FileText, Eye, Zap } from 'lucide-react';
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
  const [processingMethod, setProcessingMethod] = useState<string>('');

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
    const maxSize = 10 * 1024 * 1024; // 10MB for enhanced processing
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
    setProcessingMethod('');
    setAnalysisProgress(language === 'ar' ? 'بدء التحليل المتقدم...' : 'Starting advanced analysis...');

    try {
      const primaryFile = files[0];
      
      // Set processing method based on file type
      if (primaryFile.type.startsWith('image/')) {
        setProcessingMethod('OCR');
        setAnalysisProgress(language === 'ar' ? 'تحليل الصورة باستخدام تقنية التعرف الضوئي على الحروف المتقدمة...' : 'Analyzing image using advanced OCR technology...');
      } else if (primaryFile.type === 'application/pdf') {
        setProcessingMethod('Enhanced PDF');
        setAnalysisProgress(language === 'ar' ? 'معالجة PDF متقدمة (استخراج نص + OCR للمستندات الممسوحة ضوئياً)...' : 'Advanced PDF processing (text extraction + OCR for scanned documents)...');
      } else {
        setProcessingMethod('Text Extraction');
        setAnalysisProgress(language === 'ar' ? 'استخراج النص المتقدم...' : 'Advanced text extraction...');
      }

      console.log(`🚀 Starting enhanced analysis for criteria ${criteriaId} with file:`, primaryFile.name);
      
      const result = await langchainService.analyzeCriteria(primaryFile, criteriaId, language);
      
      console.log(`✅ Enhanced analysis completed for criteria ${criteriaId}:`, result);
      
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
      setAnalysisProgress(language === 'ar' ? 'اكتمل التحليل المتقدم بنجاح!' : 'Advanced analysis completed successfully!');

    } catch (error) {
      console.error('Enhanced analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 
        (language === 'ar' 
          ? 'حدث خطأ أثناء التحليل المتقدم للملفات'
          : 'An error occurred during advanced file analysis');
      
      setError(errorMessage);
      setAnalysisProgress('');
      
      // Provide specific error guidance
      if (errorMessage.includes('OCR')) {
        setError(language === 'ar' 
          ? 'فشل في تحليل الصورة بتقنية OCR المتقدمة. يرجى التأكد من وضوح النص في الصورة وجودة الدقة.'
          : 'Advanced OCR analysis failed. Please ensure the text in the image is clear and high resolution.');
      } else if (errorMessage.includes('PDF')) {
        setError(language === 'ar' 
          ? 'فشل في معالجة PDF المتقدمة. قد يكون الملف محمي بكلمة مرور أو تالف أو يحتوي على صور فقط.'
          : 'Advanced PDF processing failed. The file may be password-protected, corrupted, or contain only images.');
      } else if (errorMessage.includes('API key')) {
        setError(language === 'ar' 
          ? 'مفتاح OpenAI API غير صحيح أو غير موجود. يرجى التحقق من الإعدادات.'
          : 'OpenAI API key is invalid or missing. Please check your configuration.');
      }
    } finally {
      setIsAnalyzing(false);
      setProcessingMethod('');
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setAnalysis(null);
      setError('');
      setAnalysisProgress('');
      setProcessingMethod('');
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
    } else if (file.type === 'application/pdf') {
      return <Zap className="w-5 h-5 text-red-600" />;
    }
    return <File className="w-5 h-5 text-blue-600" />;
  };

  const getProcessingMethodIcon = () => {
    switch (processingMethod) {
      case 'OCR':
        return <Eye className="w-4 h-4 text-purple-600" />;
      case 'Enhanced PDF':
        return <Zap className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
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
          <p className="text-xs text-blue-600 mb-2">
            {language === 'ar' 
              ? '🚀 معالجة متقدمة للوثائق العربية'
              : '🚀 Advanced Arabic document processing'}
          </p>
          <p className="text-xs text-green-600 mb-3">
            {language === 'ar' 
              ? '✨ استخراج نص ذكي + OCR متقدم + تحليل هجين'
              : '✨ Smart text extraction + Advanced OCR + Hybrid analysis'}
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
                        {language === 'ar' ? '(صورة - OCR متقدم)' : '(Image - Advanced OCR)'}
                      </span>
                    )}
                    {file.type === 'application/pdf' && (
                      <span className="ml-2 text-red-600">
                        {language === 'ar' ? '(PDF - معالجة هجينة)' : '(PDF - Hybrid processing)'}
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
            {getProcessingMethodIcon()}
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <span className="text-blue-700 text-sm font-medium">
              {processingMethod 
                ? (language === 'ar' ? `${processingMethod} + وكلاء ذكيين` : `${processingMethod} + Smart Agents`)
                : (language === 'ar' ? 'تحليل متقدم متعدد الوكلاء' : 'Advanced Multi-Agent Analysis')
              }
            </span>
            <p className="text-xs text-blue-600 mt-1">{analysisProgress}</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !isAnalyzing && (
        <div className="mt-4 space-y-3">
          {/* Enhanced Processing Badge */}
          <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-orange-600 font-medium">
              {language === 'ar' ? 'معالجة متقدمة' : 'Enhanced Processing'}
            </span>
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-purple-600 font-medium">
              {language === 'ar' ? 'وكلاء ذكيين' : 'Smart Agents'}
            </span>
          </div>

          {/* Confidence Score */}
          <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm text-gray-600">
              {language === 'ar' ? 'ثقة النظام المتقدم:' : 'Advanced System Confidence:'}
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
                {language === 'ar' ? 'المحتوى المستخرج من الوثيقة:' : 'Content Extracted from Document:'}
              </h4>
              <div className={`bg-gray-100 border-l-4 border-blue-400 p-3 rounded text-sm text-gray-700 ${language === 'ar' ? 'border-l-0 border-r-4 text-right' : 'text-left'}`}>
                {analysis.documentContent}
              </div>
            </div>
          )}

          {/* Enhanced Findings */}
          <div>
            <h4 className={`text-sm font-medium text-gray-700 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'نتائج التحليل المتقدم:' : 'Advanced Analysis Results:'}
            </h4>
            <p className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right leading-relaxed' : 'text-left'}`}>
              {analysis.findings}
            </p>
          </div>

          {/* Evidence */}
          {analysis.evidence && analysis.evidence.length > 0 && (
            <div>
              <h4 className={`text-sm font-medium text-gray-700 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'الأدلة المستخرجة:' : 'Extracted Evidence:'}
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
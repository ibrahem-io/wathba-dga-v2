import React, { useState, useCallback } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, XCircle, Brain, Loader, Eye, Image } from 'lucide-react';
import { analyzeDocumentForCriteria } from '../services/openaiService';
import { extractTextFromFile } from '../utils/fileExtractor';

interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
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
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [processingType, setProcessingType] = useState<'text' | 'ocr' | null>(null);

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
    const maxSize = 10 * 1024 * 1024; // Increased to 10MB for image-rich PDFs
    const allowedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png'
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
    setOcrProgress('');
    setProcessingType(null);

    try {
      // Show initial progress
      setOcrProgress(language === 'ar' ? 'بدء معالجة الملفات...' : 'Starting file processing...');

      // Extract text from all files
      const extractedTexts = await Promise.all(
        files.map(async (file, index) => {
          try {
            // Update progress for each file
            setOcrProgress(language === 'ar' 
              ? `معالجة الملف ${index + 1} من ${files.length}...` 
              : `Processing file ${index + 1} of ${files.length}...`);

            // Check if file is likely to need OCR
            if (file.type === 'application/pdf') {
              setProcessingType('text');
              setOcrProgress(language === 'ar' 
                ? 'استخراج النص من ملف PDF...' 
                : 'Extracting text from PDF...');
              
              const text = await extractTextFromFile(file);
              
              // If OCR was used (indicated by the extraction process)
              if (text.includes('استخراج النص من الصور') || text.includes('OCR')) {
                setProcessingType('ocr');
                setOcrProgress(language === 'ar' 
                  ? 'تم اكتشاف صور في PDF - استخدام الذكاء الاصطناعي لقراءة النص من الصور...' 
                  : 'Images detected in PDF - Using AI to read text from images...');
              }
              
              return text;
            } else if (file.type.startsWith('image/')) {
              setProcessingType('ocr');
              setOcrProgress(language === 'ar' 
                ? 'قراءة النص من الصورة باستخدام الذكاء الاصطناعي...' 
                : 'Reading text from image using AI...');
              
              return await extractTextFromFile(file);
            } else {
              setProcessingType('text');
              return await extractTextFromFile(file);
            }
          } catch (fileError) {
            console.error(`Error processing file ${file.name}:`, fileError);
            return `[خطأ في معالجة الملف: ${file.name}]`;
          }
        })
      );

      // Combine all text content
      let combinedText = extractedTexts.join('\n\n');
      
      // Limit combined text to 80,000 characters
      const maxCombinedLength = 80000;
      if (combinedText.length > maxCombinedLength) {
        combinedText = combinedText.substring(0, maxCombinedLength) + '\n\n[Text truncated due to length...]';
      }

      if (!combinedText || combinedText.trim().length < 50) {
        throw new Error(language === 'ar' 
          ? 'لم يتم العثور على نص كافٍ في الملفات للتحليل'
          : 'Insufficient text found in files for analysis');
      }

      // Update progress for AI analysis
      setOcrProgress(language === 'ar' 
        ? 'تحليل المحتوى باستخدام الذكاء الاصطناعي...' 
        : 'Analyzing content with AI...');

      // Analyze against specific criteria
      const result = await analyzeDocumentForCriteria(combinedText, criteriaId, language);
      
      setAnalysis(result);
      onAnalysisComplete(criteriaId, result);

      // Clear progress after successful completion
      setOcrProgress('');

    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 
        (language === 'ar' 
          ? 'حدث خطأ أثناء تحليل الملفات'
          : 'An error occurred while analyzing the files'));
      setOcrProgress('');
    } finally {
      setIsAnalyzing(false);
      setProcessingType(null);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setAnalysis(null);
      setError('');
      setOcrProgress('');
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
          <div className={`flex items-center justify-center space-x-2 mb-3 text-xs text-blue-600 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <Eye className="w-4 h-4" />
            <span>
              {language === 'ar' 
                ? 'يدعم قراءة النص من الصور والمستندات الممسوحة ضوئياً باستخدام الذكاء الاصطناعي'
                : 'Supports reading text from images and scanned documents using AI'}
            </span>
          </div>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
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
                {file.type.startsWith('image/') ? (
                  <Image className="w-5 h-5 text-purple-600" />
                ) : (
                  <File className="w-5 h-5 text-blue-600" />
                )}
                <div>
                  <p className={`text-sm font-medium text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {file.name}
                  </p>
                  <p className={`text-xs text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {formatFileSize(file.size)}
                    {file.type.startsWith('image/') && (
                      <span className="ml-2 text-purple-600">
                        {language === 'ar' ? '(صورة - سيتم قراءة النص بالذكاء الاصطناعي)' : '(Image - Text will be read with AI)'}
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
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
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

      {/* Analysis Status with OCR Progress */}
      {isAnalyzing && (
        <div className={`mt-4 p-3 bg-blue-50 rounded-lg ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center space-x-2 mb-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
            {processingType === 'ocr' && <Eye className="w-5 h-5 text-purple-600" />}
            <span className="text-blue-700 text-sm font-medium">
              {language === 'ar' ? 'جاري التحليل الذكي...' : 'Smart Analysis in Progress...'}
            </span>
          </div>
          {ocrProgress && (
            <div className="text-sm text-blue-600 bg-blue-100 rounded p-2">
              {ocrProgress}
            </div>
          )}
          {processingType === 'ocr' && (
            <div className={`mt-2 text-xs text-purple-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' 
                ? '💡 يتم استخدام تقنية الذكاء الاصطناعي المتقدمة لقراءة النص من الصور'
                : '💡 Using advanced AI technology to read text from images'}
            </div>
          )}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !isAnalyzing && (
        <div className="mt-4 space-y-3">
          {/* Confidence Score */}
          <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm text-gray-600">
              {language === 'ar' ? 'ثقة الذكاء الاصطناعي:' : 'AI Confidence:'}
            </span>
            <div className={`flex items-center space-x-1 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-600">{analysis.confidence}%</span>
            </div>
          </div>

          {/* Processing Method Indicator */}
          {processingType && (
            <div className={`flex items-center space-x-2 text-xs ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
              {processingType === 'ocr' ? (
                <>
                  <Eye className="w-4 h-4 text-purple-500" />
                  <span className="text-purple-600">
                    {language === 'ar' ? 'تم استخدام تقنية قراءة النص من الصور' : 'OCR technology was used'}
                  </span>
                </>
              ) : (
                <>
                  <File className="w-4 h-4 text-blue-500" />
                  <span className="text-blue-600">
                    {language === 'ar' ? 'تم استخراج النص مباشرة' : 'Direct text extraction'}
                  </span>
                </>
              )}
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
import React, { useState, useCallback } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, XCircle, Brain, Loader, Eye } from 'lucide-react';
import { analyzeDocumentForCriteria } from '../services/openaiService';
import { langchainService } from '../services/langchainService';

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
  const [visionProgress, setVisionProgress] = useState<string>('');

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

  const handleFiles = async (files: File[]) => {
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        setError(language === 'ar' ? 'حجم الملف يجب أن يكون أقل من 10 ميجابايت' : 'File size must be less than 10MB');
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
    setVisionProgress('');

    try {
      // Show initial progress
      setVisionProgress(language === 'ar' ? 'بدء معالجة الملفات بالذكاء الاصطناعي...' : 'Starting AI Vision processing...');

      // Process files using Vision API for ALL file types
      const extractedTexts = await Promise.all(
        files.map(async (file, index) => {
          try {
            // Update progress for each file
            setVisionProgress(language === 'ar' 
              ? `معالجة الملف ${index + 1} من ${files.length} بالذكاء الاصطناعي: ${file.name}` 
              : `AI Vision processing file ${index + 1} of ${files.length}: ${file.name}`);

            console.log(`🤖 Processing file with Vision API: ${file.name}`);

            // Use the agent system which now uses Vision API for everything
            const result = await langchainService.analyzeCriteria(file, 'document_extraction', language);
            
            if (result && result.documentContent) {
              return {
                filename: file.name,
                text: result.documentContent,
                isFromVision: true
              };
            } else {
              throw new Error('No text extracted from Vision API');
            }

          } catch (fileError) {
            console.error(`Error processing file ${file.name}:`, fileError);
            
            if (fileError instanceof Error) {
              if (fileError.message.includes('unsupported image') || fileError.message.includes('invalid_image_format')) {
                throw new Error(language === 'ar' 
                  ? `تنسيق الملف "${file.name}" غير مدعوم من قبل الذكاء الاصطناعي. يرجى تحويل الملف إلى PNG أو JPEG أو GIF أو WebP والمحاولة مرة أخرى.`
                  : `File format "${file.name}" not supported by AI Vision. Please convert to PNG, JPEG, GIF, or WebP and try again.`);
              } else if (fileError.message.includes('rate limit')) {
                throw new Error(language === 'ar'
                  ? 'تم تجاوز الحد المسموح لاستخدام خدمة الذكاء الاصطناعي. يرجى المحاولة لاحقاً.'
                  : 'AI service rate limit exceeded. Please try again later.');
              }
            }
            
            throw fileError;
          }
        })
      );

      // Filter out error messages and combine valid text
      const validTexts = extractedTexts.filter(result => 
        result.text && result.text.length > 10
      );

      if (validTexts.length === 0) {
        throw new Error(language === 'ar' 
          ? 'فشل في استخراج النص من جميع الملفات باستخدام الذكاء الاصطناعي'
          : 'Failed to extract text from all files using AI Vision');
      }
      
      // Combine all text content with file source information
      let combinedText = validTexts.map(result => 
        `=== ${result.filename} (مستخرج بالذكاء الاصطناعي) ===\n${result.text}`
      ).join('\n\n--- الملف التالي ---\n\n');
      
      // Limit combined text to prevent token overflow
      const maxCombinedLength = 80000;
      if (combinedText.length > maxCombinedLength) {
        combinedText = combinedText.substring(0, maxCombinedLength) + '\n\n[Text truncated due to length...]';
      }

      // Now send the extracted text to completion API
      setVisionProgress(language === 'ar' 
        ? 'تحليل المحتوى المستخرج باستخدام الذكاء الاصطناعي...' 
        : 'Analyzing extracted content with AI...');

      console.log('📤 Sending Vision API extracted text to completion API...');
      console.log(`📊 Text length: ${combinedText.length} characters`);

      // Analyze against specific criteria using completion API
      const result = await analyzeDocumentForCriteria(combinedText, criteriaId, language, true);
      
      setAnalysis(result);
      onAnalysisComplete(criteriaId, result);

      // Clear progress after successful completion
      setVisionProgress('');

    } catch (error) {
      console.error('Analysis error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = '';
      if (error instanceof Error) {
        if (error.message.includes('unsupported image') || error.message.includes('invalid_image_format')) {
          errorMessage = language === 'ar' 
            ? 'تنسيق الملف غير مدعوم من قبل الذكاء الاصطناعي. يرجى استخدام ملفات PNG أو JPEG أو GIF أو WebP فقط.'
            : 'File format not supported by AI Vision. Please use PNG, JPEG, GIF, or WebP files only.';
        } else if (error.message.includes('rate limit')) {
          errorMessage = language === 'ar'
            ? 'تم تجاوز الحد المسموح لاستخدام خدمة الذكاء الاصطناعي. يرجى المحاولة لاحقاً.'
            : 'AI service rate limit exceeded. Please try again later.';
        } else if (error.message.includes('Vision API') || error.message.includes('الذكاء الاصطناعي')) {
          errorMessage = error.message;
        } else if (error.message.includes('API') || error.message.includes('network')) {
          errorMessage = language === 'ar' 
            ? 'خطأ في الاتصال بخدمة الذكاء الاصطناعي. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.'
            : 'Error connecting to AI service. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = language === 'ar' 
          ? 'حدث خطأ غير متوقع أثناء تحليل الملفات'
          : 'An unexpected error occurred while analyzing the files';
      }
      
      setError(errorMessage);
      setVisionProgress('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setAnalysis(null);
      setError('');
      setVisionProgress('');
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
            dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Eye className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            {language === 'ar' 
              ? 'اسحب وأفلت الملفات هنا أو انقر للتحديد'
              : 'Drag and drop files here or click to select'}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            {language === 'ar' 
              ? 'جميع أنواع الملفات مدعومة - حد أقصى 10 ميجابايت لكل ملف'
              : 'All file types supported - Max 10MB each'}
          </p>
          <div className={`flex items-center justify-center space-x-2 mb-3 text-xs text-purple-600 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <Brain className="w-4 h-4" />
            <span>
              {language === 'ar' 
                ? 'جميع الملفات تتم معالجتها بالذكاء الاصطناعي المتقدم'
                : 'All files processed with advanced AI Vision'}
            </span>
          </div>
          <div className={`text-xs text-blue-600 mb-3 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' 
              ? '🤖 تقنية الذكاء الاصطناعي تقرأ النص من جميع أنواع الملفات (PDF، DOCX، صور، إلخ)'
              : '🤖 AI Vision technology reads text from all file types (PDF, DOCX, images, etc.)'}
          </div>
          <input
            type="file"
            onChange={handleFileInput}
            className="hidden"
            id={`file-upload-${criteriaId}`}
            multiple
          />
          <label
            htmlFor={`file-upload-${criteriaId}`}
            className={`bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors text-sm ${language === 'ar' ? 'space-x-reverse' : ''}`}
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
                <Eye className="w-5 h-5 text-purple-600" />
                <div>
                  <p className={`text-sm font-medium text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {file.name}
                  </p>
                  <p className={`text-xs text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {formatFileSize(file.size)}
                    <span className="ml-2 text-purple-600">
                      {language === 'ar' ? '(معالجة بالذكاء الاصطناعي)' : '(AI Vision Processing)'}
                    </span>
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
              onChange={handleFileInput}
              className="hidden"
              id={`file-upload-more-${criteriaId}`}
              multiple
            />
            <label
              htmlFor={`file-upload-more-${criteriaId}`}
              className={`text-purple-600 hover:text-purple-700 cursor-pointer inline-flex items-center space-x-1 text-sm ${language === 'ar' ? 'space-x-reverse' : ''}`}
            >
              <Upload className="w-4 h-4" />
              <span>{language === 'ar' ? 'إضافة ملفات أخرى' : 'Add More Files'}</span>
            </label>
          </div>
        </div>
      )}

      {/* Analysis Status with Vision API Progress */}
      {isAnalyzing && (
        <div className={`mt-4 p-3 bg-purple-50 rounded-lg ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center space-x-2 mb-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <Loader className="w-5 h-5 text-purple-600 animate-spin" />
            <Eye className="w-5 h-5 text-purple-600" />
            <span className="text-purple-700 text-sm font-medium">
              {language === 'ar' ? 'جاري التحليل بالذكاء الاصطناعي...' : 'AI Vision Analysis in Progress...'}
            </span>
          </div>
          {visionProgress && (
            <div className="text-sm text-purple-600 bg-purple-100 rounded p-2">
              {visionProgress}
            </div>
          )}
          <div className={`mt-2 text-xs text-purple-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' 
              ? '🤖 يتم استخدام تقنية الذكاء الاصطناعي المتقدمة لقراءة وتحليل جميع الملفات'
              : '🤖 Using advanced AI Vision technology to read and analyze all files'}
          </div>
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

          {/* Vision Processing Indicator */}
          <div className={`flex items-center space-x-2 text-xs ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <Eye className="w-4 h-4 text-purple-500" />
            <span className="text-purple-600">
              {language === 'ar' ? 'تم استخدام تقنية الذكاء الاصطناعي لقراءة جميع الملفات' : 'AI Vision technology was used to read all files'}
            </span>
          </div>

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
                  <div key={index} className={`bg-white border-l-4 border-purple-400 p-2 rounded text-xs text-gray-600 italic ${language === 'ar' ? 'border-l-0 border-r-4 text-right' : 'text-left'}`}>
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
        <div className={`mt-4 p-4 bg-red-50 border border-red-200 rounded-lg ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center space-x-2 mb-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 text-sm font-medium">
              {language === 'ar' ? 'خطأ في المعالجة' : 'Processing Error'}
            </span>
          </div>
          <p className="text-red-700 text-sm mb-3">
            {error}
          </p>
          
          {/* Helpful suggestions for unsupported formats */}
          {(error.includes('unsupported') || error.includes('غير مدعوم')) && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
              <h4 className={`text-sm font-medium text-blue-800 mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'الحل المقترح:' : 'Suggested Solution:'}
              </h4>
              <ul className={`text-sm text-blue-700 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-600`}>•</span>
                  <span>
                    {language === 'ar' 
                      ? 'استخدم ملفات PNG أو JPEG أو GIF أو WebP فقط'
                      : 'Use PNG, JPEG, GIF, or WebP files only'}
                  </span>
                </li>
                <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-600`}>•</span>
                  <span>
                    {language === 'ar' 
                      ? 'قم بتحويل ملفات PDF أو DOCX إلى صور للحصول على أفضل النتائج'
                      : 'Convert PDF or DOCX files to images for best results'}
                  </span>
                </li>
              </ul>
            </div>
          )}
          
          {(error.includes('rate limit') || error.includes('الحد المسموح')) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
              <h4 className={`text-sm font-medium text-yellow-800 mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'تم تجاوز الحد المسموح:' : 'Rate Limit Exceeded:'}
              </h4>
              <p className={`text-sm text-yellow-700 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' 
                  ? 'يرجى الانتظار قليلاً قبل المحاولة مرة أخرى. خدمة الذكاء الاصطناعي لديها حدود استخدام.'
                  : 'Please wait a moment before trying again. The AI service has usage limits.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
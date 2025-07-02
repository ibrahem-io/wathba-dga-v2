import React, { useState, useCallback } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, XCircle, Brain, Loader, Eye, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import { analyzeDocumentForCriteriaEnhanced } from '../services/enhancedOpenaiService';
import { extractTextFromFile, detectLanguage, isVisualDocument } from '../utils/fileExtractor';
import { TextQualityAnalyzer } from '../services/textQualityAnalyzer';

interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
  textQuality?: 'high' | 'medium' | 'low' | 'poor';
  processingNotes?: string[];
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

export default function EnhancedCriteriaUploadBox({
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
  const [extractedText, setExtractedText] = useState<string>('');
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [textQualityInfo, setTextQualityInfo] = useState<{
    quality: 'high' | 'medium' | 'low' | 'poor';
    issues: string[];
    suggestions: string[];
  } | null>(null);

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
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    const validFiles = files.filter(file => {
      if (isVisualDocument(file)) {
        setError(language === 'ar' 
          ? `الملف "${file.name}" هو صورة. هذا النظام يعالج الوثائق النصية فقط. يرجى رفع ملفات PDF أو DOCX أو TXT.`
          : `File "${file.name}" is an image. This system processes text documents only. Please upload PDF, DOCX, or TXT files.`);
        return false;
      }

      if (file.size > maxSize) {
        setError(language === 'ar' ? 'حجم الملف يجب أن يكون أقل من 10 ميجابايت' : 'File size must be less than 10MB');
        return false;
      }
      
      if (!allowedTypes.includes(file.type)) {
        setError(language === 'ar' 
          ? `نوع الملف "${file.name}" غير مدعوم. يرجى رفع ملفات PDF أو DOCX أو TXT فقط.`
          : `File type "${file.name}" not supported. Please upload PDF, DOCX, or TXT files only.`);
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
    setExtractedText('');
    setProcessingProgress('');
    setTextQualityInfo(null);

    try {
      console.log(`Extracting text from ${files.length} file(s)...`);
      
      setProcessingProgress(language === 'ar' ? 'بدء معالجة الملفات...' : 'Starting file processing...');
      
      const extractedTexts = await Promise.all(
        files.map(async (file, index) => {
          try {
            setProcessingProgress(language === 'ar' 
              ? `معالجة الملف ${index + 1} من ${files.length}: ${file.name}` 
              : `Processing file ${index + 1} of ${files.length}: ${file.name}`);

            console.log(`Processing file ${index + 1}: ${file.name}`);
            const text = await extractTextFromFile(file);
            
            console.log(`Extracted ${text.length} characters from ${file.name}`);
            
            if (!text || text.trim().length < 10) {
              throw new Error(
                language === 'ar' 
                  ? `الملف "${file.name}" لا يحتوي على نص كافٍ للتحليل (${text.length} حرف)`
                  : `File "${file.name}" does not contain sufficient text for analysis (${text.length} characters)`
              );
            }
            
            return {
              filename: file.name,
              text: text,
              isFromText: true
            };
          } catch (extractError) {
            console.error(`❌ Document parsing failed for ${file.name}:`, extractError);
            throw extractError;
          }
        })
      );

      const validTexts = extractedTexts.filter(result => 
        result.text && result.text.length > 10
      );

      if (validTexts.length === 0) {
        throw new Error(language === 'ar' 
          ? 'فشل في استخراج النص من جميع الملفات'
          : 'Failed to extract text from all files');
      }

      let combinedText = validTexts.map(result => 
        `=== ${result.filename} ===\n${result.text}`
      ).join('\n\n--- الملف التالي ---\n\n');
      
      // تحليل جودة النص
      setProcessingProgress(language === 'ar' 
        ? 'فحص جودة النص المستخرج...' 
        : 'Checking extracted text quality...');
      
      const qualityAnalysis = TextQualityAnalyzer.analyzeAndCleanText(combinedText, language);
      setTextQualityInfo({
        quality: qualityAnalysis.quality,
        issues: qualityAnalysis.issues,
        suggestions: qualityAnalysis.suggestions
      });
      
      // عرض معاينة النص
      setExtractedText(qualityAnalysis.cleanedText.substring(0, 1000) + 
        (qualityAnalysis.cleanedText.length > 1000 ? '...' : ''));
      
      // إذا كانت جودة النص ضعيفة جداً، أظهر تحذير
      if (qualityAnalysis.quality === 'poor') {
        setError(language === 'ar' 
          ? `جودة النص المستخرج ضعيفة جداً. المشاكل: ${qualityAnalysis.issues.join('، ')}`
          : `Extracted text quality is very poor. Issues: ${qualityAnalysis.issues.join(', ')}`);
        return;
      }
      
      const detectedLang = detectLanguage(combinedText);
      console.log(`Detected language: ${detectedLang}, UI language: ${language}`);
      
      const maxCombinedLength = 80000;
      if (combinedText.length > maxCombinedLength) {
        combinedText = combinedText.substring(0, maxCombinedLength) + '\n\n[Text truncated due to length...]';
        console.log(`Text truncated from ${combinedText.length} to ${maxCombinedLength} characters`);
      }

      if (!combinedText || combinedText.trim().length < 50) {
        throw new Error(language === 'ar' 
          ? 'لم يتم العثور على نص كافٍ في الملفات للتحليل'
          : 'Insufficient text found in files for analysis');
      }

      setProcessingProgress(language === 'ar' 
        ? 'تحليل المحتوى باستخدام الذكاء الاصطناعي المحسن...' 
        : 'Analyzing content with enhanced AI...');

      console.log(`Sending ${combinedText.length} characters to enhanced AI analysis...`);

      // استخدام التحليل المحسن
      const result = await analyzeDocumentForCriteriaEnhanced(combinedText, criteriaId, language);
      
      console.log('Enhanced analysis completed:', result);
      
      setAnalysis(result);
      onAnalysisComplete(criteriaId, result);

      setProcessingProgress('');

    } catch (error) {
      console.error('Analysis error:', error);
      
      let errorMessage = '';
      
      if (error instanceof Error) {
        if (error.message.includes('جودة النص') || error.message.includes('text quality')) {
          errorMessage = error.message;
        } else if (error.message.includes('API key')) {
          errorMessage = language === 'ar' 
            ? 'مفتاح OpenAI API غير صحيح. يرجى التحقق من الإعدادات'
            : 'Invalid OpenAI API key. Please check your configuration';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = language === 'ar' 
            ? 'خطأ في الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى'
            : 'Network connection error. Please check your connection and try again';
        } else {
          errorMessage = language === 'ar' 
            ? `حدث خطأ أثناء تحليل الملفات: ${error.message}`
            : `An error occurred while analyzing the files: ${error.message}`;
        }
      } else {
        errorMessage = language === 'ar' 
          ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى'
          : 'An unexpected error occurred. Please try again';
      }
      
      setError(errorMessage);
      setProcessingProgress('');
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
      setExtractedText('');
      setProcessingProgress('');
      setTextQualityInfo(null);
    } else {
      analyzeFiles(newFiles);
    }
  };

  const retryAnalysis = () => {
    if (uploadedFiles.length > 0) {
      analyzeFiles(uploadedFiles);
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

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-orange-600 bg-orange-100';
      case 'poor':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
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
          <FileText className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            {language === 'ar' 
              ? 'اسحب وأفلت الملفات هنا أو انقر للتحديد'
              : 'Drag and drop files here or click to select'}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            {language === 'ar' 
              ? 'ملفات PDF أو DOCX أو TXT (حد أقصى 10 ميجابايت لكل ملف)'
              : 'PDF, DOCX, or TXT files (Max 10MB each)'}
          </p>
          <div className={`flex items-center justify-center space-x-2 mb-3 text-xs text-blue-600 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <Brain className="w-4 h-4" />
            <span>
              {language === 'ar' 
                ? 'تحليل ذكي محسن مع فحص جودة النص'
                : 'Enhanced smart analysis with text quality check'}
            </span>
          </div>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
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
                <File className="w-5 h-5 text-blue-600" />
                <div>
                  <p className={`text-sm font-medium text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {file.name}
                  </p>
                  <p className={`text-xs text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {formatFileSize(file.size)}
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
              accept=".pdf,.docx,.txt"
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

      {/* Text Quality Indicator */}
      {textQualityInfo && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className={`flex items-center justify-between mb-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm text-gray-600">
              {language === 'ar' ? 'جودة النص المستخرج:' : 'Extracted Text Quality:'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQualityColor(textQualityInfo.quality)}`}>
              {language === 'ar' ? 
                (textQualityInfo.quality === 'high' ? 'عالية' :
                 textQualityInfo.quality === 'medium' ? 'متوسطة' :
                 textQualityInfo.quality === 'low' ? 'منخفضة' : 'ضعيفة') :
                textQualityInfo.quality}
            </span>
          </div>
          
          {textQualityInfo.issues.length > 0 && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">
                {language === 'ar' ? 'المشاكل المكتشفة: ' : 'Issues detected: '}
              </span>
              {textQualityInfo.issues.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Text Preview */}
      {extractedText && (
        <div className="mt-4">
          <button
            onClick={() => setShowTextPreview(!showTextPreview)}
            className={`flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 ${language === 'ar' ? 'space-x-reverse' : ''}`}
          >
            <Eye className="w-4 h-4" />
            <span>
              {language === 'ar' 
                ? (showTextPreview ? 'إخفاء معاينة النص' : 'عرض معاينة النص المحسن')
                : (showTextPreview ? 'Hide text preview' : 'Show enhanced text preview')}
            </span>
          </button>
          
          {showTextPreview && (
            <div className="mt-2 p-3 bg-gray-100 rounded-lg border">
              <p className={`text-xs text-gray-600 mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'معاينة النص المحسن:' : 'Enhanced text preview:'}
              </p>
              <pre className={`text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {extractedText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Analysis Status */}
      {isAnalyzing && (
        <div className={`mt-4 p-3 bg-blue-50 rounded-lg ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center space-x-2 mb-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-blue-700 text-sm font-medium">
              {language === 'ar' ? 'جاري التحليل الذكي المحسن...' : 'Enhanced Smart Analysis in Progress...'}
            </span>
          </div>
          {processingProgress && (
            <div className="text-sm text-blue-600 bg-blue-100 rounded p-2">
              {processingProgress}
            </div>
          )}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !isAnalyzing && (
        <div className="mt-4 space-y-3">
          {/* Confidence and Quality Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <span className="text-sm text-gray-600">
                {language === 'ar' ? 'ثقة الذكاء الاصطناعي:' : 'AI Confidence:'}
              </span>
              <div className={`flex items-center space-x-1 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-purple-600">{analysis.confidence}%</span>
              </div>
            </div>
            
            {analysis.textQuality && (
              <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm text-gray-600">
                  {language === 'ar' ? 'جودة النص:' : 'Text Quality:'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQualityColor(analysis.textQuality)}`}>
                  {language === 'ar' ? 
                    (analysis.textQuality === 'high' ? 'عالية' :
                     analysis.textQuality === 'medium' ? 'متوسطة' :
                     analysis.textQuality === 'low' ? 'منخفضة' : 'ضعيفة') :
                    analysis.textQuality}
                </span>
              </div>
            )}
          </div>

          {/* Processing Notes */}
          {analysis.processingNotes && analysis.processingNotes.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <div className={`flex items-center space-x-2 mb-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {language === 'ar' ? 'ملاحظات المعالجة:' : 'Processing Notes:'}
                </span>
              </div>
              <ul className={`text-sm text-yellow-700 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {analysis.processingNotes.map((note, index) => (
                  <li key={index} className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-yellow-600`}>•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Findings */}
          <div>
            <h4 className={`text-sm font-medium text-gray-700 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'نتائج التحليل المحسن:' : 'Enhanced Analysis Results:'}
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
                {analysis.evidence.slice(0, 3).map((evidence, index) => (
                  <div key={index} className={`bg-white border-l-4 border-blue-400 p-2 rounded text-xs text-gray-600 italic ${language === 'ar' ? 'border-l-0 border-r-4 text-right' : 'text-left'}`}>
                    "{evidence}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div>
              <h4 className={`text-sm font-medium text-gray-700 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'التوصيات:' : 'Recommendations:'}
              </h4>
              <ul className={`text-sm text-gray-600 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {analysis.recommendations.slice(0, 3).map((recommendation, index) => (
                  <li key={index} className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>•</span>
                    <span className="leading-relaxed">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error Display with Enhanced Suggestions */}
      {error && (
        <div className="mt-4 space-y-2">
          <div className={`p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <span className={`text-red-700 text-sm ${language === 'ar' ? 'text-right' : 'text-left'} whitespace-pre-line`}>
                {error}
              </span>
            </div>
          </div>
          
          {/* Enhanced Suggestions */}
          {textQualityInfo && textQualityInfo.suggestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <h4 className={`text-sm font-medium text-blue-800 mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'اقتراحات لتحسين جودة النص:' : 'Suggestions to improve text quality:'}
              </h4>
              <ul className={`text-sm text-blue-700 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {textQualityInfo.suggestions.map((suggestion, index) => (
                  <li key={index} className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-600`}>•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {uploadedFiles.length > 0 && (
            <div className="text-center">
              <button
                onClick={retryAnalysis}
                className={`text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1 text-sm ${language === 'ar' ? 'space-x-reverse' : ''}`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retry Analysis'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
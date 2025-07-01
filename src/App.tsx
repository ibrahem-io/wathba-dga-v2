import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ComplianceChecklist from './components/ComplianceChecklist';
import ResultsDashboard from './components/ResultsDashboard';
import AnalysisProgress from './components/AnalysisProgress';
import { defaultComplianceItems, ChecklistItem } from './data/complianceItems';
import { analyzeDocument, checkApiKey, AnalysisResult } from './services/openaiService';
import { extractTextFromFile, detectLanguage } from './utils/fileExtractor';

function App() {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar'); // Default to Arabic for Saudi government
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [complianceItems, setComplianceItems] = useState<ChecklistItem[]>(defaultComplianceItems);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState<'extracting' | 'analyzing' | 'processing' | 'complete'>('extracting');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [apiError, setApiError] = useState<string>('');

  // Set document direction based on language
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    
    // Add Arabic font class to body
    if (language === 'ar') {
      document.body.classList.add('font-arabic');
    } else {
      document.body.classList.remove('font-arabic');
    }
  }, [language]);

  // Check API key on component mount
  useEffect(() => {
    const validateApiKey = async () => {
      const isValid = await checkApiKey();
      if (!isValid) {
        setApiError(language === 'ar' 
          ? 'مفتاح OpenAI API غير صحيح. يرجى التحقق من الإعدادات.'
          : 'Invalid OpenAI API key. Please check your configuration.');
      }
    };
    validateApiKey();
  }, [language]);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setApiError('');
    await performAIAnalysis(file);
  };

  const performAIAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setCurrentAnalysisStep('extracting');

    try {
      // Step 1: Extract text from file
      setAnalysisProgress(20);
      const extractedText = await extractTextFromFile(file);
      
      if (!extractedText || extractedText.trim().length < 100) {
        throw new Error(language === 'ar' 
          ? 'لم يتم العثور على نص كافٍ في الملف للتحليل. يرجى التأكد من أن الملف يحتوي على محتوى نصي واضح.'
          : 'Insufficient text found in file for analysis. Please ensure the file contains clear textual content.');
      }

      // Step 2: Detect language and analyze
      setCurrentAnalysisStep('analyzing');
      setAnalysisProgress(40);
      
      const detectedLanguage = detectLanguage(extractedText);
      const result = await analyzeDocument(extractedText, detectedLanguage);

      // Step 3: Process results
      setCurrentAnalysisStep('processing');
      setAnalysisProgress(80);

      // Update compliance items with AI analysis
      const updatedItems = complianceItems.map(item => {
        const aiAnalysis = result.requirements.find(req => req.requirementId === item.id);
        if (aiAnalysis) {
          return {
            ...item,
            status: aiAnalysis.status,
            aiAnalysis: {
              confidence: aiAnalysis.confidence,
              evidence: aiAnalysis.evidence,
              findings: aiAnalysis.findings,
              recommendations: aiAnalysis.recommendations
            }
          };
        }
        return item;
      });

      setComplianceItems(updatedItems);
      setAnalysisResult(result);
      
      // Complete
      setCurrentAnalysisStep('complete');
      setAnalysisProgress(100);
      
      setTimeout(() => {
        setIsAnalyzing(false);
      }, 1000);

    } catch (error) {
      console.error('Analysis error:', error);
      setApiError(error instanceof Error ? error.message : 
        (language === 'ar' 
          ? 'حدث خطأ أثناء تحليل الوثيقة بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.'
          : 'An error occurred while analyzing the document with AI. Please try again.'));
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setAnalysisResult(null);
    setApiError('');
    // Reset all items to pending
    setComplianceItems(items => 
      items.map(item => ({ 
        ...item, 
        status: 'pending' as const,
        aiAnalysis: undefined
      }))
    );
  };

  const handleItemUpdate = (id: string, status: 'pass' | 'fail' | 'partial') => {
    setComplianceItems(items =>
      items.map(item => 
        item.id === id ? { ...item, status } : item
      )
    );
  };

  const handleExportReport = () => {
    const reportData = {
      fileName: uploadedFile?.name,
      date: new Date().toISOString().split('T')[0],
      dateArabic: new Date().toLocaleDateString('ar-SA'),
      items: complianceItems,
      analysisResult: analysisResult,
      language: language,
      standard: {
        number: '5.4',
        titleAr: 'الثقافة والبيئة الرقمية',
        titleEn: 'Digital Culture and Environment',
        authority: language === 'ar' ? 'هيئة الحكومة الرقمية' : 'Digital Government Authority',
        country: language === 'ar' ? 'المملكة العربية السعودية' : 'Kingdom of Saudi Arabia'
      }
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = language === 'ar' 
      ? `تقرير_الامتثال_معيار_5.4_${new Date().toISOString().split('T')[0]}.json`
      : `DGA_5.4_Compliance_Report_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${language === 'ar' ? 'font-arabic' : ''}`}>
      <Header language={language} onLanguageChange={setLanguage} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* API Error Display */}
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">!</span>
                </div>
                <span className={`text-red-700 text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {apiError}
                </span>
              </div>
            </div>
          )}

          {/* Step 1: File Upload */}
          <FileUpload
            language={language}
            onFileUpload={handleFileUpload}
            uploadedFile={uploadedFile}
            onRemoveFile={handleRemoveFile}
          />

          {/* Analysis Progress */}
          {isAnalyzing && (
            <AnalysisProgress
              language={language}
              currentStep={currentAnalysisStep}
              progress={analysisProgress}
            />
          )}

          {/* Step 2: Compliance Checklist */}
          {uploadedFile && !isAnalyzing && (
            <ComplianceChecklist
              language={language}
              items={complianceItems}
              onItemUpdate={handleItemUpdate}
              isAnalyzing={false}
              showAIAnalysis={true}
            />
          )}

          {/* Step 3: Results Dashboard */}
          {uploadedFile && !isAnalyzing && analysisResult && (
            <ResultsDashboard
              language={language}
              items={complianceItems}
              fileName={uploadedFile.name}
              onExportReport={handleExportReport}
              analysisResult={analysisResult}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-12">
        <div className="container mx-auto px-4">
          <div className={`text-center ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            <p className="text-sm text-gray-600">
              {language === 'ar' 
                ? '© 2024 هيئة الحكومة الرقمية - المملكة العربية السعودية'
                : '© 2024 Digital Government Authority - Kingdom of Saudi Arabia'}
            </p>
            <p className="text-xs mt-1 text-gray-500">
              {language === 'ar'
                ? 'أداة التدقيق الذكية لمعيار الثقافة والبيئة الرقمية 5.4 - مدعومة بالذكاء الاصطناعي'
                : 'Smart Auditing Tool for Digital Culture and Environment Standard 5.4 - AI-Powered'}
            </p>
            <p className="text-xs mt-1 text-blue-600">
              {language === 'ar'
                ? 'تحليل متقدم للوثائق العربية والإنجليزية'
                : 'Advanced Analysis for Arabic and English Documents'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
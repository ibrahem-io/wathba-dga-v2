import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CriteriaUploadGrid from './components/CriteriaUploadGrid';
import DocumentChatPage from './components/DocumentChatPage';
import SystemStatusPanel from './components/SystemStatusPanel';
import { langchainService } from './services/langchainService';

function App() {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar'); // Default to Arabic for Saudi government
  const [currentPage, setCurrentPage] = useState<'audit' | 'chat'>('audit');
  const [apiError, setApiError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

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

  // Initialize LangChain service
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setIsInitializing(true);
        await langchainService.initialize();
        console.log('LangChain multi-agent system initialized successfully');
      } catch (error) {
        console.error('Failed to initialize LangChain system:', error);
        setApiError(language === 'ar' 
          ? 'فشل في تهيئة نظام الوكلاء الذكيين. يرجى التحقق من إعدادات API.'
          : 'Failed to initialize smart agent system. Please check API configuration.');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSystem();

    // Note: Removed cleanup function that was calling langchainService.shutdown()
    // The langchainService is a singleton and should persist throughout the app lifecycle
  }, [language]);

  return (
    <div className={`min-h-screen bg-gray-50 ${language === 'ar' ? 'font-arabic' : ''}`}>
      <Header 
        language={language} 
        onLanguageChange={setLanguage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Initialization Status */}
          {isInitializing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className={`text-blue-700 text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {language === 'ar' 
                    ? 'جاري تهيئة نظام الوكلاء الذكيين...'
                    : 'Initializing smart agent system...'}
                </span>
              </div>
            </div>
          )}

          {/* API Error Display */}
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
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

          {/* Main Content */}
          {!isInitializing && (
            <>
              {currentPage === 'audit' && <CriteriaUploadGrid language={language} />}
              {currentPage === 'chat' && <DocumentChatPage language={language} />}
            </>
          )}
        </div>
      </main>

      {/* System Status Panel */}
      <SystemStatusPanel language={language} />

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
              {currentPage === 'chat' ? (
                language === 'ar'
                  ? 'محادثة ذكية مع الوثائق العربية - مدعومة بالذكاء الاصطناعي المتقدم'
                  : 'Smart conversation with Arabic documents - Powered by advanced AI'
              ) : (
                language === 'ar'
                  ? 'أداة التدقيق الذكية لمعيار الثقافة والبيئة الرقمية 5.4 - مدعومة بنظام الوكلاء الذكيين'
                  : 'Smart Auditing Tool for Digital Culture and Environment Standard 5.4 - Powered by Multi-Agent System'
              )}
            </p>
            <p className="text-xs mt-1 text-blue-600">
              {language === 'ar'
                ? 'تحليل متقدم للوثائق العربية والإنجليزية باستخدام LangChain.js'
                : 'Advanced Analysis for Arabic and English Documents using LangChain.js'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
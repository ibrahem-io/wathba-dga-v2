import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CriteriaUploadGrid from './components/CriteriaUploadGrid';
import { checkApiKey } from './services/openaiService';

function App() {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar'); // Default to Arabic for Saudi government
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

  return (
    <div className={`min-h-screen bg-gray-50 ${language === 'ar' ? 'font-arabic' : ''}`}>
      <Header language={language} onLanguageChange={setLanguage} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
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
          <CriteriaUploadGrid language={language} />
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
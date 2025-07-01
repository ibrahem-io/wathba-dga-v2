import React from 'react';
import { Shield, FileCheck } from 'lucide-react';

interface HeaderProps {
  language: 'ar' | 'en';
  onLanguageChange: (lang: 'ar' | 'en') => void;
}

export default function Header({ language, onLanguageChange }: HeaderProps) {
  return (
    <header className="bg-blue-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center space-x-4 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <div className="bg-white p-2 rounded-lg">
              <Shield className="w-8 h-8 text-blue-800" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' 
                  ? 'مدقق الامتثال لمعيار الهيئة 5.4'
                  : 'DGA Standard 5.4 Compliance Auditor'}
              </h1>
              <p className={`text-blue-100 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar'
                  ? 'الثقافة والبيئة الرقمية - مدعوم بالذكاء الاصطناعي'
                  : 'Digital Culture and Environment - AI-Powered'}
              </p>
            </div>
          </div>
          
          <div className={`flex items-center space-x-4 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <button
              onClick={() => onLanguageChange(language === 'ar' ? 'en' : 'ar')}
              className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
            <div className="bg-white p-2 rounded-lg">
              <FileCheck className="w-6 h-6 text-blue-800" />
            </div>
          </div>
        </div>
        
        {/* Government Authority Info */}
        <div className={`mt-4 pt-4 border-t border-blue-700 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <p className="text-blue-100 text-sm">
            {language === 'ar' 
              ? 'هيئة الحكومة الرقمية - المملكة العربية السعودية'
              : 'Digital Government Authority - Kingdom of Saudi Arabia'}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            {language === 'ar'
              ? 'معيار الثقافة والبيئة الرقمية 5.4 - أداة التدقيق الذكية'
              : 'Digital Culture and Environment Standard 5.4 - Smart Auditing Tool'}
          </p>
        </div>
      </div>
    </header>
  );
}
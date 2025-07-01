import React from 'react';
import { Brain, FileText, Search, CheckCircle } from 'lucide-react';

interface AnalysisProgressProps {
  language: 'ar' | 'en';
  currentStep: 'extracting' | 'analyzing' | 'processing' | 'complete';
  progress: number;
}

export default function AnalysisProgress({ language, currentStep, progress }: AnalysisProgressProps) {
  const steps = [
    {
      id: 'extracting',
      icon: FileText,
      labelAr: 'استخراج النص من الوثيقة',
      labelEn: 'Extracting Text from Document'
    },
    {
      id: 'analyzing',
      icon: Brain,
      labelAr: 'تحليل المحتوى بالذكاء الاصطناعي',
      labelEn: 'AI Content Analysis'
    },
    {
      id: 'processing',
      icon: Search,
      labelAr: 'معالجة النتائج والتوصيات',
      labelEn: 'Processing Results and Recommendations'
    },
    {
      id: 'complete',
      icon: CheckCircle,
      labelAr: 'اكتمل التحليل بنجاح',
      labelEn: 'Analysis Completed Successfully'
    }
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep);
  };

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className={`text-center mb-6 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {language === 'ar' ? 'جاري تحليل الوثيقة بالذكاء الاصطناعي...' : 'AI Document Analysis in Progress...'}
        </h3>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600">
          {progress}% {language === 'ar' ? 'مكتمل' : 'Complete'}
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div 
              key={step.id}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''
              } ${
                isActive ? 'bg-blue-50 border border-blue-200' :
                isCompleted ? 'bg-green-50 border border-green-200' :
                'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className={`p-2 rounded-full ${
                isActive ? 'bg-blue-100' :
                isCompleted ? 'bg-green-100' :
                'bg-gray-100'
              }`}>
                <Icon className={`w-5 h-5 ${
                  isActive ? 'text-blue-600' :
                  isCompleted ? 'text-green-600' :
                  'text-gray-400'
                }`} />
              </div>
              <div className="flex-1">
                <p className={`font-medium ${
                  isActive ? 'text-blue-800' :
                  isCompleted ? 'text-green-800' :
                  'text-gray-500'
                } ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {language === 'ar' ? step.labelAr : step.labelEn}
                </p>
              </div>
              {isActive && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
              {isCompleted && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className={`text-sm text-blue-700 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {language === 'ar' 
            ? 'يتم تحليل الوثيقة باستخدام الذكاء الاصطناعي للتحقق من الامتثال لمعيار الثقافة والبيئة الرقمية 5.4 الخاص بهيئة الحكومة الرقمية'
            : 'Document is being analyzed using AI to check compliance with DGA Digital Culture and Environment Standard 5.4'}
        </p>
      </div>
    </div>
  );
}
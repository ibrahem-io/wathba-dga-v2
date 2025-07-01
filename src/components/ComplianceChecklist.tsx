import React from 'react';
import { CheckCircle, XCircle, AlertCircle, FileText, Brain } from 'lucide-react';
import AIAnalysisResults from './AIAnalysisResults';

interface ChecklistItem {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  status: 'pass' | 'fail' | 'partial' | 'pending';
  aiAnalysis?: {
    confidence: number;
    evidence: string[];
    findings: string;
    recommendations: string[];
  };
}

interface ComplianceChecklistProps {
  language: 'ar' | 'en';
  items: ChecklistItem[];
  onItemUpdate: (id: string, status: 'pass' | 'fail' | 'partial') => void;
  isAnalyzing: boolean;
  showAIAnalysis?: boolean;
}

export default function ComplianceChecklist({ 
  language, 
  items, 
  onItemUpdate, 
  isAnalyzing, 
  showAIAnalysis = false 
}: ComplianceChecklistProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pass: { 
        bg: 'bg-green-100', 
        text: 'text-green-800',
        labelAr: 'مطابق',
        labelEn: 'Pass'
      },
      fail: { 
        bg: 'bg-red-100', 
        text: 'text-red-800',
        labelAr: 'غير مطابق',
        labelEn: 'Fail'
      },
      partial: { 
        bg: 'bg-yellow-100', 
        text: 'text-yellow-800',
        labelAr: 'جزئي',
        labelEn: 'Partial'
      },
      pending: { 
        bg: 'bg-gray-100', 
        text: 'text-gray-600',
        labelAr: 'في الانتظار',
        labelEn: 'Pending'
      }
    };

    const badge = badges[status as keyof typeof badges];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {language === 'ar' ? badge.labelAr : badge.labelEn}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className={`flex items-center justify-between mb-6 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
        <h2 className={`text-xl font-bold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? '2. مراجعة متطلبات المعيار 5.4' : '2. Review Standard 5.4 Requirements'}
        </h2>
        {showAIAnalysis && (
          <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <Brain className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-600 font-medium">
              {language === 'ar' ? 'تحليل بالذكاء الاصطناعي' : 'AI Analysis'}
            </span>
          </div>
        )}
        {isAnalyzing && (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-600">
              {language === 'ar' ? 'جاري التحليل...' : 'Analyzing...'}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {items.map((item) => (
          <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className={`flex items-start justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-start space-x-3 flex-1 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
                {getStatusIcon(item.status)}
                <div className="flex-1">
                  <h3 className={`font-semibold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? item.titleAr : item.titleEn}
                  </h3>
                  <p className={`text-sm text-gray-600 mt-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? item.descriptionAr : item.descriptionEn}
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 ml-4 ${language === 'ar' ? 'space-x-reverse mr-4 ml-0' : ''}`}>
                {getStatusBadge(item.status)}
                {!isAnalyzing && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => onItemUpdate(item.id, 'pass')}
                      className="p-1 rounded hover:bg-green-50 transition-colors"
                      title={language === 'ar' ? 'مطابق' : 'Pass'}
                    >
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </button>
                    <button
                      onClick={() => onItemUpdate(item.id, 'partial')}
                      className="p-1 rounded hover:bg-yellow-50 transition-colors"
                      title={language === 'ar' ? 'جزئي' : 'Partial'}
                    >
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    </button>
                    <button
                      onClick={() => onItemUpdate(item.id, 'fail')}
                      className="p-1 rounded hover:bg-red-50 transition-colors"
                      title={language === 'ar' ? 'غير مطابق' : 'Fail'}
                    >
                      <XCircle className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* AI Analysis Results */}
            {showAIAnalysis && item.aiAnalysis && (
              <div className="mt-4">
                <AIAnalysisResults
                  language={language}
                  analysis={{
                    requirementId: item.id,
                    status: item.status,
                    confidence: item.aiAnalysis.confidence,
                    evidence: item.aiAnalysis.evidence,
                    findings: item.aiAnalysis.findings,
                    recommendations: item.aiAnalysis.recommendations
                  }}
                  requirementTitle={language === 'ar' ? item.titleAr : item.titleEn}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Brain, Quote, Lightbulb } from 'lucide-react';
import { ComplianceAnalysis } from '../services/openaiService';

interface AIAnalysisResultsProps {
  language: 'ar' | 'en';
  analysis: ComplianceAnalysis;
  requirementTitle: string;
}

export default function AIAnalysisResults({ language, analysis, requirementTitle }: AIAnalysisResultsProps) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'border-green-200 bg-green-50';
      case 'fail':
        return 'border-red-200 bg-red-50';
      case 'partial':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      pass: { ar: 'مطابق', en: 'Compliant' },
      fail: { ar: 'غير مطابق', en: 'Non-Compliant' },
      partial: { ar: 'مطابق جزئياً', en: 'Partially Compliant' }
    };
    return statusMap[status as keyof typeof statusMap]?.[language] || status;
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(analysis.status)}`}>
      <div className={`flex items-start justify-between mb-3 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
          {getStatusIcon(analysis.status)}
          <div>
            <h4 className={`font-semibold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {requirementTitle}
            </h4>
            <span className={`text-sm font-medium ${
              analysis.status === 'pass' ? 'text-green-700' :
              analysis.status === 'fail' ? 'text-red-700' :
              'text-yellow-700'
            }`}>
              {getStatusText(analysis.status)}
            </span>
          </div>
        </div>
        <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
          <Brain className="w-4 h-4 text-blue-500" />
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(analysis.confidence)}`}>
            {analysis.confidence}% {language === 'ar' ? 'ثقة' : 'confidence'}
          </span>
        </div>
      </div>

      {/* AI Findings */}
      <div className="mb-3">
        <h5 className={`text-sm font-medium text-gray-700 mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? 'نتائج التحليل بالذكاء الاصطناعي:' : 'AI Analysis Results:'}
        </h5>
        <p className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right leading-relaxed' : 'text-left'}`}>
          {analysis.findings}
        </p>
      </div>

      {/* Evidence */}
      {analysis.evidence && analysis.evidence.length > 0 && (
        <div className="mb-3">
          <h5 className={`text-sm font-medium text-gray-700 mb-2 flex items-center ${language === 'ar' ? 'text-right flex-row-reverse' : 'text-left'}`}>
            <Quote className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
            {language === 'ar' ? 'الأدلة من الوثيقة:' : 'Evidence from Document:'}
          </h5>
          <div className="space-y-2">
            {analysis.evidence.map((evidence, index) => (
              <div key={index} className={`bg-white border-r-4 border-blue-400 p-2 rounded ${language === 'ar' ? 'border-r-0 border-l-4' : ''}`}>
                <p className={`text-sm text-gray-600 italic ${language === 'ar' ? 'text-right leading-relaxed' : 'text-left'}`}>
                  "{evidence}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div>
          <h5 className={`text-sm font-medium text-gray-700 mb-2 flex items-center ${language === 'ar' ? 'text-right flex-row-reverse' : 'text-left'}`}>
            <Lightbulb className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
            {language === 'ar' ? 'التوصيات للتحسين:' : 'Improvement Recommendations:'}
          </h5>
          <ul className={`text-sm text-gray-600 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {analysis.recommendations.map((recommendation, index) => (
              <li key={index} className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>•</span>
                <span className="leading-relaxed">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
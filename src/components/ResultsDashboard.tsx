import React from 'react';
import { BarChart3, Download, FileText, CheckCircle, XCircle, AlertCircle, Brain, TrendingUp, Award } from 'lucide-react';
import { AnalysisResult } from '../services/openaiService';

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

interface ResultsDashboardProps {
  language: 'ar' | 'en';
  items: ChecklistItem[];
  fileName: string | undefined;
  onExportReport: () => void;
  analysisResult?: AnalysisResult;
}

export default function ResultsDashboard({ 
  language, 
  items, 
  fileName, 
  onExportReport, 
  analysisResult 
}: ResultsDashboardProps) {
  const calculateStats = () => {
    const total = items.length;
    const pass = items.filter(item => item.status === 'pass').length;
    const fail = items.filter(item => item.status === 'fail').length;
    const partial = items.filter(item => item.status === 'partial').length;
    const pending = items.filter(item => item.status === 'pending').length;
    
    const score = Math.round(((pass + partial * 0.5) / total) * 100);
    
    return { total, pass, fail, partial, pending, score };
  };

  const stats = calculateStats();
  
  const getComplianceLevel = (score: number) => {
    if (score >= 80) return { 
      level: language === 'ar' ? 'ممتاز' : 'Excellent', 
      color: 'text-green-600', 
      bg: 'bg-green-100' 
    };
    if (score >= 60) return { 
      level: language === 'ar' ? 'جيد' : 'Good', 
      color: 'text-yellow-600', 
      bg: 'bg-yellow-100' 
    };
    if (score >= 40) return { 
      level: language === 'ar' ? 'مقبول' : 'Fair', 
      color: 'text-orange-600', 
      bg: 'bg-orange-100' 
    };
    return { 
      level: language === 'ar' ? 'ضعيف' : 'Poor', 
      color: 'text-red-600', 
      bg: 'bg-red-100' 
    };
  };

  const complianceLevel = getComplianceLevel(stats.score);

  const getAverageConfidence = () => {
    const itemsWithAnalysis = items.filter(item => item.aiAnalysis);
    if (itemsWithAnalysis.length === 0) return 0;
    
    const totalConfidence = itemsWithAnalysis.reduce((sum, item) => 
      sum + (item.aiAnalysis?.confidence || 0), 0);
    return Math.round(totalConfidence / itemsWithAnalysis.length);
  };

  const averageConfidence = getAverageConfidence();

  const getCurrentDate = () => {
    const now = new Date();
    if (language === 'ar') {
      return now.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className={`flex items-center justify-between mb-6 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
        <h2 className={`text-xl font-bold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? '3. تقرير الامتثال الذكي' : '3. Smart Compliance Report'}
        </h2>
        <button
          onClick={onExportReport}
          className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${language === 'ar' ? 'space-x-reverse' : ''}`}
        >
          <Download className="w-4 h-4" />
          <span>{language === 'ar' ? 'تصدير التقرير' : 'Export Report'}</span>
        </button>
      </div>

      {/* Document Info */}
      {fileName && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-800">
              {language === 'ar' ? 'الوثيقة المدققة:' : 'Audited Document:'}
            </span>
            <span className="text-gray-600">{fileName}</span>
          </div>
          <div className={`flex items-center space-x-2 mt-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <span className="text-sm text-gray-500">
              {language === 'ar' ? 'تاريخ التدقيق:' : 'Audit Date:'}
            </span>
            <span className="text-sm text-gray-600">{getCurrentDate()}</span>
          </div>
        </div>
      )}

      {/* Overall Score and AI Confidence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <div>
              <p className={`text-blue-100 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'النتيجة الإجمالية' : 'Overall Score'}
              </p>
              <p className={`text-3xl font-bold ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {stats.score}%
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        <div className={`${complianceLevel.bg} rounded-lg p-6`}>
          <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <div>
              <p className={`text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'مستوى الامتثال' : 'Compliance Level'}
              </p>
              <p className={`text-2xl font-bold ${complianceLevel.color} ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {complianceLevel.level}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full ${complianceLevel.bg} flex items-center justify-center`}>
              {stats.score >= 80 ? (
                <Award className="w-5 h-5 text-green-600" />
              ) : stats.score >= 60 ? (
                <CheckCircle className="w-5 h-5 text-yellow-600" />
              ) : stats.score >= 40 ? (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-6">
          <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <div>
              <p className={`text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'ثقة الذكاء الاصطناعي' : 'AI Confidence'}
              </p>
              <p className={`text-2xl font-bold text-purple-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {averageConfidence}%
              </p>
            </div>
            <Brain className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{stats.pass}</p>
          <p className="text-sm text-green-700">
            {language === 'ar' ? 'مطابق' : 'Compliant'}
          </p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <AlertCircle className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-600">{stats.partial}</p>
          <p className="text-sm text-yellow-700">
            {language === 'ar' ? 'جزئي' : 'Partial'}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-600">{stats.fail}</p>
          <p className="text-sm text-red-700">
            {language === 'ar' ? 'غير مطابق' : 'Non-Compliant'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="w-6 h-6 border-2 border-gray-400 rounded-full mx-auto mb-2"></div>
          <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
          <p className="text-sm text-gray-700">
            {language === 'ar' ? 'في الانتظار' : 'Pending'}
          </p>
        </div>
      </div>

      {/* AI Summary */}
      {analysisResult && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className={`font-semibold text-blue-800 mb-2 flex items-center ${language === 'ar' ? 'text-right flex-row-reverse' : 'text-left'}`}>
            <Brain className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {language === 'ar' ? 'ملخص التحليل الذكي' : 'Smart Analysis Summary'}
          </h3>
          <p className={`text-sm text-blue-700 leading-relaxed ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {analysisResult.summary}
          </p>
        </div>
      )}

      {/* Critical Issues */}
      {analysisResult && analysisResult.criticalIssues && analysisResult.criticalIssues.length > 0 && (
        <div className="bg-red-50 rounded-lg p-4 mb-6">
          <h3 className={`font-semibold text-red-800 mb-2 flex items-center ${language === 'ar' ? 'text-right flex-row-reverse' : 'text-left'}`}>
            <AlertCircle className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {language === 'ar' ? 'القضايا الحرجة' : 'Critical Issues'}
          </h3>
          <ul className={`text-sm text-red-700 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {analysisResult.criticalIssues.map((issue, index) => (
              <li key={index} className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-red-500`}>•</span>
                <span className="leading-relaxed">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-green-50 rounded-lg p-4">
        <h3 className={`font-semibold text-green-800 mb-2 flex items-center ${language === 'ar' ? 'text-right flex-row-reverse' : 'text-left'}`}>
          <TrendingUp className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
          {language === 'ar' ? 'التوصيات للتحسين' : 'Improvement Recommendations'}
        </h3>
        <ul className={`text-sm text-green-700 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {stats.fail > 0 && (
            <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-green-500`}>•</span>
              <span className="leading-relaxed">
                {language === 'ar' 
                  ? `يجب معالجة ${stats.fail} متطلب غير مطابق لتحسين مستوى الامتثال للثقافة الرقمية`
                  : `Address ${stats.fail} non-compliant requirement(s) to improve digital culture compliance`}
              </span>
            </li>
          )}
          {stats.partial > 0 && (
            <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-green-500`}>•</span>
              <span className="leading-relaxed">
                {language === 'ar' 
                  ? `يمكن تحسين ${stats.partial} متطلب جزئي للوصول إلى الامتثال الكامل`
                  : `Improve ${stats.partial} partial requirement(s) for full compliance`}
              </span>
            </li>
          )}
          {averageConfidence < 70 && (
            <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-green-500`}>•</span>
              <span className="leading-relaxed">
                {language === 'ar' 
                  ? 'قد تحتاج الوثيقة إلى مزيد من التفاصيل حول الثقافة الرقمية لتحسين دقة التحليل'
                  : 'Document may need more details about digital culture to improve analysis accuracy'}
              </span>
            </li>
          )}
          {stats.score >= 80 && (
            <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-green-500`}>•</span>
              <span className="leading-relaxed">
                {language === 'ar' 
                  ? 'مستوى امتثال ممتاز للثقافة الرقمية! استمر في المراجعة الدورية والتحسين المستمر'
                  : 'Excellent digital culture compliance level! Continue regular reviews and continuous improvement'}
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { BarChart3, Download, Award, TrendingUp } from 'lucide-react';
import CriteriaUploadBox from './CriteriaUploadBox';
import { defaultComplianceItems } from '../data/complianceItems';

interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
}

interface CriteriaUploadGridProps {
  language: 'ar' | 'en';
}

export default function CriteriaUploadGrid({ language }: CriteriaUploadGridProps) {
  const [analyses, setAnalyses] = useState<Record<string, CriteriaAnalysis>>({});

  const handleAnalysisComplete = (criteriaId: string, analysis: CriteriaAnalysis) => {
    setAnalyses(prev => ({
      ...prev,
      [criteriaId]: analysis
    }));
  };

  const calculateOverallStats = () => {
    const completedAnalyses = Object.values(analyses);
    if (completedAnalyses.length === 0) {
      return {
        overallScore: 0,
        averageConfidence: 0,
        passCount: 0,
        partialCount: 0,
        failCount: 0,
        completedCount: 0,
        totalCount: defaultComplianceItems.length
      };
    }

    const overallScore = Math.round(
      completedAnalyses.reduce((sum, analysis) => sum + analysis.score, 0) / completedAnalyses.length
    );

    const averageConfidence = Math.round(
      completedAnalyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / completedAnalyses.length
    );

    const passCount = completedAnalyses.filter(a => a.status === 'pass').length;
    const partialCount = completedAnalyses.filter(a => a.status === 'partial').length;
    const failCount = completedAnalyses.filter(a => a.status === 'fail').length;

    return {
      overallScore,
      averageConfidence,
      passCount,
      partialCount,
      failCount,
      completedCount: completedAnalyses.length,
      totalCount: defaultComplianceItems.length
    };
  };

  const stats = calculateOverallStats();

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

  const complianceLevel = getComplianceLevel(stats.overallScore);

  const exportReport = () => {
    const reportData = {
      date: new Date().toISOString().split('T')[0],
      dateArabic: new Date().toLocaleDateString('ar-SA'),
      language: language,
      overallStats: stats,
      criteriaAnalyses: analyses,
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
    <div className="space-y-8">
      {/* Header */}
      <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
        <div>
          <h1 className={`text-2xl font-bold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'تدقيق معيار الثقافة والبيئة الرقمية 5.4' : 'Digital Culture and Environment Standard 5.4 Audit'}
          </h1>
          <p className={`text-gray-600 mt-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' 
              ? 'ارفع الوثائق لكل متطلب للحصول على تحليل ذكي مفصل'
              : 'Upload documents for each requirement to get detailed smart analysis'}
          </p>
        </div>
        
        {stats.completedCount > 0 && (
          <button
            onClick={exportReport}
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${language === 'ar' ? 'space-x-reverse' : ''}`}
          >
            <Download className="w-4 h-4" />
            <span>{language === 'ar' ? 'تصدير التقرير' : 'Export Report'}</span>
          </button>
        )}
      </div>

      {/* Overall Statistics */}
      {stats.completedCount > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className={`text-lg font-semibold text-gray-800 mb-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'الإحصائيات العامة' : 'Overall Statistics'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
              <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <div>
                  <p className={`text-blue-100 text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'النتيجة الإجمالية' : 'Overall Score'}
                  </p>
                  <p className={`text-2xl font-bold ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {stats.overallScore}%
                  </p>
                </div>
                <BarChart3 className="w-6 h-6 text-blue-200" />
              </div>
            </div>

            <div className={`${complianceLevel.bg} rounded-lg p-4`}>
              <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <div>
                  <p className={`text-gray-600 text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'مستوى الامتثال' : 'Compliance Level'}
                  </p>
                  <p className={`text-xl font-bold ${complianceLevel.color} ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {complianceLevel.level}
                  </p>
                </div>
                <Award className={`w-6 h-6 ${complianceLevel.color}`} />
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <div>
                  <p className={`text-gray-600 text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'ثقة الذكاء الاصطناعي' : 'AI Confidence'}
                  </p>
                  <p className={`text-xl font-bold text-purple-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {stats.averageConfidence}%
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <div>
                  <p className={`text-gray-600 text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'التقدم' : 'Progress'}
                  </p>
                  <p className={`text-xl font-bold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {stats.completedCount}/{stats.totalCount}
                  </p>
                </div>
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-600">
                    {Math.round((stats.completedCount / stats.totalCount) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.passCount}</div>
              <div className="text-sm text-green-700">
                {language === 'ar' ? 'مطابق' : 'Compliant'}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.partialCount}</div>
              <div className="text-sm text-yellow-700">
                {language === 'ar' ? 'جزئي' : 'Partial'}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failCount}</div>
              <div className="text-sm text-red-700">
                {language === 'ar' ? 'غير مطابق' : 'Non-Compliant'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Criteria Upload Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {defaultComplianceItems.map((item) => (
          <CriteriaUploadBox
            key={item.id}
            language={language}
            criteriaId={item.id}
            titleAr={item.titleAr}
            titleEn={item.titleEn}
            descriptionAr={item.descriptionAr}
            descriptionEn={item.descriptionEn}
            onAnalysisComplete={handleAnalysisComplete}
          />
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className={`font-semibold text-blue-800 mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? 'تعليمات الاستخدام' : 'Usage Instructions'}
        </h3>
        <ul className={`text-sm text-blue-700 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>1.</span>
            <span>
              {language === 'ar' 
                ? 'ارفع الوثائق ذات الصلة لكل متطلب من متطلبات المعيار 5.4'
                : 'Upload relevant documents for each Standard 5.4 requirement'}
            </span>
          </li>
          <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>2.</span>
            <span>
              {language === 'ar' 
                ? 'سيتم تحليل كل وثيقة تلقائياً بالذكاء الاصطناعي وإعطاء نتيجة امتثال'
                : 'Each document will be automatically analyzed by AI and given a compliance score'}
            </span>
          </li>
          <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>3.</span>
            <span>
              {language === 'ar' 
                ? 'راجع النتائج والتوصيات لكل متطلب وصدّر التقرير النهائي'
                : 'Review results and recommendations for each requirement and export the final report'}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
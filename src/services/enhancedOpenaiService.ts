import OpenAI from 'openai';
import { TextQualityAnalyzer } from './textQualityAnalyzer';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
  textQuality?: 'high' | 'medium' | 'low' | 'poor';
  processingNotes?: string[];
}

/**
 * تحليل محسن للوثائق مع فحص جودة النص
 */
export async function analyzeDocumentForCriteriaEnhanced(
  documentText: string, 
  criteriaId: string, 
  language: 'ar' | 'en'
): Promise<CriteriaAnalysis> {
  try {
    console.log(`🔍 Starting enhanced analysis for criteria ${criteriaId}`);
    console.log(`📊 Original text length: ${documentText.length} characters`);
    
    // تحليل وتحسين جودة النص أولاً
    const textAnalysis = TextQualityAnalyzer.analyzeAndCleanText(documentText, language);
    
    console.log(`📈 Text quality: ${textAnalysis.quality}`);
    console.log(`🔧 Issues found: ${textAnalysis.issues.length}`);
    
    // إذا كانت جودة النص ضعيفة جداً، أرجع تحليل خاص
    if (textAnalysis.quality === 'poor') {
      return {
        score: 0,
        status: 'fail',
        confidence: 30,
        evidence: [],
        findings: language === 'ar' 
          ? `الوثيقة المقدمة تحتوي على نص غير مقروء أو مشوش، مما يجعل من الصعب تحديد أي إشارات واضحة للمتطلب ${criteriaId}. المشاكل المكتشفة: ${textAnalysis.issues.join('، ')}`
          : `The provided document contains unreadable or garbled text, making it difficult to identify clear indicators for requirement ${criteriaId}. Issues detected: ${textAnalysis.issues.join(', ')}`,
        recommendations: [
          ...textAnalysis.suggestions,
          ...(language === 'ar' ? [
            'تحقق من أن الملف غير تالف وقابل للقراءة',
            'جرب رفع نسخة أخرى من الوثيقة',
            'استخدم تنسيق ملف مختلف (PDF نصي، DOCX، أو TXT)'
          ] : [
            'Verify that the file is not corrupted and is readable',
            'Try uploading another copy of the document',
            'Use a different file format (text PDF, DOCX, or TXT)'
          ])
        ],
        textQuality: textAnalysis.quality,
        processingNotes: textAnalysis.issues
      };
    }
    
    // استخدام النص المحسن للتحليل
    const cleanedText = textAnalysis.cleanedText;
    console.log(`✨ Cleaned text length: ${cleanedText.length} characters`);
    
    // إجراء التحليل العادي مع النص المحسن
    const result = await analyzeWithImprovedPrompt(cleanedText, criteriaId, language);
    
    // إضافة معلومات جودة النص للنتيجة
    result.textQuality = textAnalysis.quality;
    result.processingNotes = textAnalysis.issues;
    
    // تعديل الثقة بناءً على جودة النص
    if (textAnalysis.quality === 'low') {
      result.confidence = Math.max(40, result.confidence - 20);
      result.recommendations.unshift(
        language === 'ar' 
          ? 'جودة النص المستخرج منخفضة - قد تحتاج لتحسين الوثيقة الأصلية'
          : 'Extracted text quality is low - may need to improve the original document'
      );
    } else if (textAnalysis.quality === 'medium') {
      result.confidence = Math.max(50, result.confidence - 10);
    }
    
    return result;
    
  } catch (error) {
    console.error('Enhanced analysis error:', error);
    throw error;
  }
}

/**
 * تحليل محسن مع prompt متطور
 */
async function analyzeWithImprovedPrompt(
  cleanedText: string,
  criteriaId: string,
  language: 'ar' | 'en'
): Promise<CriteriaAnalysis> {
  
  const enhancedPrompt = getEnhancedPrompt(criteriaId, language);
  
  // تحديد طول النص المناسب للتحليل
  const maxTextLength = 40000;
  let textToAnalyze = cleanedText;
  
  if (cleanedText.length > maxTextLength) {
    // أخذ النص من البداية والنهاية للحصول على سياق أفضل
    const halfLength = maxTextLength / 2;
    const startText = cleanedText.substring(0, halfLength);
    const endText = cleanedText.substring(cleanedText.length - halfLength);
    textToAnalyze = startText + '\n\n[... النص مقطوع للطول ...]\n\n' + endText;
  }
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: enhancedPrompt
      },
      {
        role: "user",
        content: `${language === 'ar' ? 'محتوى الوثيقة للتحليل مقابل المتطلب' : 'Document content for analysis against requirement'} ${criteriaId}:\n\n${textToAnalyze}`
      }
    ],
    temperature: 0.1,
    max_tokens: 2500,
    response_format: { type: "json_object" }
  });

  const responseContent = response.choices[0].message.content;
  if (!responseContent) {
    throw new Error('Empty response from OpenAI API');
  }

  let result;
  try {
    result = JSON.parse(responseContent);
  } catch (parseError) {
    console.error('JSON parsing error:', parseError);
    throw new Error('Invalid JSON response from OpenAI API');
  }
  
  // التحقق من صحة النتيجة
  const validatedResult: CriteriaAnalysis = {
    score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 0,
    status: ['pass', 'fail', 'partial'].includes(result.status) ? result.status : 'fail',
    confidence: typeof result.confidence === 'number' ? Math.max(40, Math.min(95, result.confidence)) : 60,
    evidence: Array.isArray(result.evidence) ? result.evidence.slice(0, 5) : [],
    findings: typeof result.findings === 'string' ? result.findings : 'لا توجد نتائج تحليل متاحة',
    recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : []
  };

  return validatedResult;
}

/**
 * الحصول على prompt محسن لكل معيار
 */
function getEnhancedPrompt(criteriaId: string, language: 'ar' | 'en'): string {
  const prompts = {
    '5.4.1': {
      ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.1: "إعداد دراسات وبرامج لتعزيز الثقافة والبيئة الرقمية"

الهدف: تحديد مستوى وعي منسوبي الجهة الحكومية بالتحول الرقمي وإعداد الدراسات والبرامج اللازمة لزيادة هذا الوعي.

ابحث بعناية عن أي إشارة إلى:

📊 الدراسات والتقييمات:
- دراسات أو تقييمات أو مسوحات لمستوى الوعي
- تحليل الاحتياجات التدريبية أو المهارات
- استطلاعات رأي الموظفين حول التقنية
- تقييم الفجوات في المعرفة الرقمية

📚 البرامج والمبادرات:
- برامج تدريبية أو توعوية
- ورش عمل أو دورات تقنية
- مواد تعليمية أو إرشادية
- منصات تعلم إلكتروني

🎯 التخطيط والأهداف:
- خطط لتطوير الوعي الرقمي
- أهداف متعلقة بالثقافة الرقمية
- مبادرات لتحسين المهارات

كن متساهلاً في التقييم - أي إشارة لهذه العناصر تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (40-95),
  "findings": "تحليل مفصل يوضح ما تم العثور عليه مع ربطه بالمتطلبات المحددة",
  "evidence": ["اقتباس محدد 1", "اقتباس محدد 2"],
  "recommendations": ["توصية محددة 1", "توصية محددة 2"]
}`,
      en: `You are an expert auditor specialized in evaluating requirement 5.4.1: "Preparing Studies and Programs for Enhancing Digital Culture and Environment"

Objective: Determine the level of digital transformation awareness among government entity employees and prepare necessary studies and programs to increase this awareness.

Look carefully for any reference to:

📊 Studies and Assessments:
- Studies, assessments, or surveys of awareness levels
- Training needs or skills analysis
- Employee surveys about technology
- Digital knowledge gap assessments

📚 Programs and Initiatives:
- Training or awareness programs
- Technical workshops or courses
- Educational or guidance materials
- E-learning platforms

🎯 Planning and Objectives:
- Plans to develop digital awareness
- Objectives related to digital culture
- Initiatives to improve skills

Be lenient in evaluation - any reference to these elements counts as positive.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (40-95),
  "findings": "detailed analysis explaining what was found linked to specific requirements",
  "evidence": ["specific quote 1", "specific quote 2"],
  "recommendations": ["specific recommendation 1", "specific recommendation 2"]
}`
    },
    '5.4.2': {
      ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.2: "تنفيذ وتقييم برامج رفع الوعي"

ابحث بعناية عن أي إشارة إلى:

🚀 التنفيذ والتطبيق:
- تنفيذ أو تطبيق برامج توعوية
- إجراء ورش عمل أو دورات
- تفعيل مبادرات تدريبية
- تطبيق أنشطة تطويرية

📈 القياس والمتابعة:
- إحصائيات أو أرقام حول التدريب
- معدلات المشاركة أو الحضور
- تقارير عن الأنشطة المنفذة
- مؤشرات الأداء أو النتائج

🔍 التقييم والمراجعة:
- تقييم أثر البرامج
- مراجعة فعالية الأنشطة
- تحليل النتائج والمخرجات
- تحديث أو تطوير البرامج

كن متساهلاً - أي دليل على التنفيذ أو القياس يعتبر إيجابياً.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (40-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "evidence": ["اقتباس محدد 1", "اقتباس محدد 2"],
  "recommendations": ["توصية محددة 1", "توصية محددة 2"]
}`,
      en: `You are an expert auditor specialized in evaluating requirement 5.4.2: "Implementation and Evaluation of Awareness Programs"

Look carefully for any reference to:

🚀 Implementation and Execution:
- Implementation or execution of awareness programs
- Conducting workshops or courses
- Activating training initiatives
- Implementing development activities

📈 Measurement and Monitoring:
- Statistics or numbers about training
- Participation or attendance rates
- Reports on implemented activities
- Performance indicators or results

🔍 Evaluation and Review:
- Evaluation of program impact
- Review of activity effectiveness
- Analysis of results and outputs
- Updates or development of programs

Be lenient - any evidence of implementation or measurement counts as positive.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (40-95),
  "findings": "detailed analysis linking evidence to specific requirements",
  "evidence": ["specific quote 1", "specific quote 2"],
  "recommendations": ["specific recommendation 1", "specific recommendation 2"]
}`
    }
  };

  return prompts[criteriaId as keyof typeof prompts]?.[language] || getGenericEnhancedPrompt(criteriaId, language);
}

function getGenericEnhancedPrompt(criteriaId: string, language: 'ar' | 'en'): string {
  return language === 'ar' ? `
أنت خبير مدقق متخصص في تقييم معايير هيئة الحكومة الرقمية السعودية.

قم بتحليل الوثيقة بعناية للبحث عن أدلة الامتثال للمتطلب ${criteriaId}.

كن متساهلاً وشاملاً في تقييمك وقدم رؤى قابلة للتنفيذ.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (40-95),
  "findings": "تحليل مفصل",
  "evidence": ["دليل 1", "دليل 2"],
  "recommendations": ["توصية 1", "توصية 2"]
}
` : `
You are an expert auditor specialized in evaluating Saudi Arabia's Digital Governance Authority standards.

Carefully analyze the document for evidence of compliance with requirement ${criteriaId}.

Be lenient, thorough, and provide actionable insights in your assessment.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (40-95),
  "findings": "detailed analysis",
  "evidence": ["evidence 1", "evidence 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}
`;
}

// إعادة تصدير الدالة الأصلية للتوافق مع الكود الموجود
export const analyzeDocumentForCriteria = analyzeDocumentForCriteriaEnhanced;
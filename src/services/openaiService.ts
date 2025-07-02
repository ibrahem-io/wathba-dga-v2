// src/services/openaiService.ts - Enhanced with better prompts and error handling

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface ComplianceAnalysis {
  requirementId: string;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
}

export interface AnalysisResult {
  overallScore: number;
  language: 'ar' | 'en';
  requirements: ComplianceAnalysis[];
  summary: string;
  criticalIssues: string[];
}

export interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
}

// Enhanced criteria prompts with more lenient evaluation
const ENHANCED_CRITERIA_PROMPTS = {
  '5.4.1': {
    ar: `أنت خبير مدقق لمعيار هيئة الحكومة الرقمية 5.4.1: "دراسات وبرامج الوعي بالتحول الرقمي"

المتطلب: إعداد دراسات لتحديد مستوى وعي منسوبي الجهة بعملية التحول الرقمي وإعداد البرامج التوعوية.

ابحث عن هذه المؤشرات (أي منها يعتبر إيجابياً):

🔍 دراسات وتقييمات:
- استطلاعات أو مسوحات للموظفين
- تحليل احتياجات التدريب
- تقييم المهارات التقنية
- دراسات الفجوات المعرفية

📚 برامج ومبادرات:
- برامج تدريبية أو توعوية
- ورش عمل أو دورات
- حملات توعوية داخلية
- مواد تعليمية رقمية
- منصات تعلم إلكتروني

📋 مؤشرات التخطيط:
- خطط تطوير الوعي الرقمي
- أهداف الثقافة الرقمية
- مبادرات تحسين المهارات

كن متساهلاً - أي إشارة بسيطة لهذه العناصر تعتبر تقدماً إيجابياً.`,
    en: `You are an expert auditor for DGA Standard 5.4.1: "Digital Transformation Awareness Studies and Programs"

Requirement: Conduct studies to determine staff awareness levels and develop awareness programs.

Look for these indicators (any counts as positive):

🔍 Studies & Assessments:
- Employee surveys or polls
- Training needs analysis  
- Technical skills evaluation
- Knowledge gap studies

📚 Programs & Initiatives:
- Training or awareness programs
- Workshops or courses
- Internal awareness campaigns
- Digital educational materials
- E-learning platforms

📋 Planning Indicators:
- Digital awareness development plans
- Digital culture objectives
- Skills improvement initiatives

Be lenient - any simple reference to these elements counts as positive progress.`
  },
  '5.4.2': {
    ar: `أنت خبير مدقق لمعيار هيئة الحكومة الرقمية 5.4.2: "تنفيذ وتقييم برامج رفع الوعي"

المتطلب: تنفيذ البرامج المعتمدة وقياس نسب إنجازها وتقييم فعاليتها.

ابحث عن هذه المؤشرات:

⚡ التنفيذ والتطبيق:
- تطبيق برامج تدريبية
- تنفيذ ورش عمل
- إجراء أنشطة تطويرية
- تفعيل مبادرات التعلم

📊 القياس والمتابعة:
- إحصائيات التدريب
- معدلات المشاركة
- تقارير الأنشطة
- مؤشرات الأداء

🔄 التقييم والمراجعة:
- تقييم أثر البرامج
- مراجعة الفعالية
- تحليل النتائج
- تحديث البرامج

أي دليل على تنفيذ أو قياس الأنشطة يعتبر إيجابياً.`,
    en: `You are an expert auditor for DGA Standard 5.4.2: "Implementation and Evaluation of Awareness Programs"

Requirement: Implement approved programs, measure achievement rates, and evaluate effectiveness.

Look for these indicators:

⚡ Implementation & Execution:
- Training program implementation
- Workshop execution
- Development activities
- Learning initiative activation

📊 Measurement & Monitoring:
- Training statistics
- Participation rates
- Activity reports
- Performance indicators

🔄 Evaluation & Review:
- Program impact assessment
- Effectiveness reviews
- Results analysis
- Program updates

Any evidence of implementing or measuring activities counts as positive.`
  },
  '5.4.3': {
    ar: `أنت خبير مدقق لمعيار هيئة الحكومة الرقمية 5.4.3: "استخدام ودعم الأدوات التقنية"

المتطلب: تحسين استخدام الأدوات التقنية وتنظيم ورش التدريب وإنشاء قنوات الدعم.

ابحث عن هذه المؤشرات:

🛠️ الأدوات والأنظمة:
- أنظمة أو برمجيات عمل
- منصات رقمية
- أدوات الإنتاجية
- تقنيات حديثة
- حلول رقمية

🎓 التدريب والدعم:
- تدريب على الأدوات التقنية
- دعم فني أو تقني
- أدلة الاستخدام
- فرق الدعم
- مراكز المساعدة

📈 الاستخدام والاعتماد:
- استخدام يومي للأدوات
- اعتماد تقنيات جديدة
- تحسين العمليات
- قياس الفعالية

أي ذكر لاستخدام التقنية يعتبر إيجابياً.`,
    en: `You are an expert auditor for DGA Standard 5.4.3: "Use and Support of Technical Tools"

Requirement: Improve technical tools usage, organize training workshops, and establish support channels.

Look for these indicators:

🛠️ Tools & Systems:
- Work systems or software
- Digital platforms  
- Productivity tools
- Modern technologies
- Digital solutions

🎓 Training & Support:
- Technical tools training
- Technical support
- User guides
- Support teams
- Help centers

📈 Usage & Adoption:
- Daily tool usage
- New technology adoption
- Process improvement
- Effectiveness measurement

Any mention of technology usage counts as positive.`
  },
  '5.4.4': {
    ar: `أنت خبير مدقق لمعيار هيئة الحكومة الرقمية 5.4.4: "التطوير المستمر للثقافة الرقمية"

المتطلب: وضع استراتيجيات للتطوير المستمر ومتابعة تطبيقها وقياس أثرها.

ابحث عن هذه المؤشرات:

🎯 الاستراتيجيات والخطط:
- استراتيجيات التطوير
- خطط مستقبلية
- رؤية رقمية
- أهداف استراتيجية
- مبادرات التحسين

📋 المتابعة والتطبيق:
- متابعة تنفيذ الخطط
- مراجعة دورية
- تقارير التقدم
- آليات المراقبة

📊 قياس الأثر والتحسين:
- قياس أثر التطوير
- مؤشرات النجاح
- التحسين المستمر
- تطوير القدرات

أي إشارة للتخطيط المستقبلي أو التطوير يعتبر إيجابياً.`,
    en: `You are an expert auditor for DGA Standard 5.4.4: "Continuous Development of Digital Culture"

Requirement: Develop strategies for continuous development, monitor implementation, and measure impact.

Look for these indicators:

🎯 Strategies & Plans:
- Development strategies
- Future plans
- Digital vision
- Strategic objectives
- Improvement initiatives

📋 Monitoring & Implementation:
- Plan implementation monitoring
- Periodic reviews
- Progress reports
- Oversight mechanisms

📊 Impact Measurement & Improvement:
- Development impact measurement
- Success indicators
- Continuous improvement
- Capacity development

Any reference to future planning or development counts as positive.`
  }
};

export async function analyzeDocumentForCriteria(
  documentText: string, 
  criteriaId: string, 
  language: 'ar' | 'en'
): Promise<CriteriaAnalysis> {
  try {
    console.log(`🤖 Starting AI analysis for criteria ${criteriaId}`);
    console.log(`📝 Document text length: ${documentText.length}`);
    console.log(`🌐 Language: ${language}`);
    console.log(`🔤 Text preview: "${documentText.substring(0, 300)}..."`);

    const prompt = ENHANCED_CRITERIA_PROMPTS[criteriaId as keyof typeof ENHANCED_CRITERIA_PROMPTS];
    if (!prompt) {
      throw new Error(`Unknown criteria ID: ${criteriaId}`);
    }

    const criteriaPrompt = prompt[language];
    
    const systemPrompt = language === 'ar' ? `
${criteriaPrompt}

🎯 نظام التقييم المتساهل:
- "pass" (70+ نقطة): يوجد دليل واضح على المتطلب
- "partial" (40-69 نقطة): يوجد إشارة للمتطلب لكن تحتاج تطوير  
- "fail" (أقل من 40 نقطة): لا يوجد إشارة واضحة للمتطلب

⚡ كن إيجابياً ومشجعاً:
- ابحث عن نقاط القوة أولاً
- أي إشارة بسيطة للمتطلب تعتبر إنجازاً
- قدم توصيات بناءة وعملية

أرجع JSON بهذا الهيكل فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (75-95),
  "evidence": ["اقتباس محدد 1", "اقتباس محدد 2"],
  "findings": "تحليل إيجابي ومتوازن",
  "recommendations": ["توصية بناءة 1", "توصية بناءة 2"]
}
` : `
${criteriaPrompt}

🎯 Lenient Scoring System:
- "pass" (70+ points): Clear evidence of requirement
- "partial" (40-69 points): Reference to requirement but needs development
- "fail" (less than 40 points): No clear reference to requirement

⚡ Be positive and encouraging:
- Look for strengths first
- Any simple reference to requirement counts as achievement
- Provide constructive, practical recommendations

Return JSON with this structure only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (75-95),
  "evidence": ["specific quote 1", "specific quote 2"],
  "findings": "positive balanced analysis",
  "recommendations": ["constructive recommendation 1", "constructive recommendation 2"]
}
`;

    // Limit text to prevent token overflow
    const maxTextLength = 50000;
    let limitedText = documentText;
    if (documentText.length > maxTextLength) {
      limitedText = documentText.substring(0, maxTextLength) + '\n\n[Text truncated due to length...]';
      console.log(`✂️ Text truncated from ${documentText.length} to ${limitedText.length} characters`);
    }

    console.log(`🚀 Sending to OpenAI...`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `${language === 'ar' ? 'محتوى الوثيقة للتحليل مقابل المتطلب' : 'Document content for analysis against requirement'} ${criteriaId}:\n\n${limitedText}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('Empty response from OpenAI API');
    }

    console.log(`📥 Raw OpenAI response: ${responseContent}`);

    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      console.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from OpenAI API');
    }
    
    // Validate and clean the result
    const validatedResult: CriteriaAnalysis = {
      score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 0,
      status: ['pass', 'fail', 'partial'].includes(result.status) ? result.status : 'fail',
      confidence: typeof result.confidence === 'number' ? Math.max(75, Math.min(95, result.confidence)) : 80,
      evidence: Array.isArray(result.evidence) ? result.evidence.slice(0, 5) : [],
      findings: typeof result.findings === 'string' ? result.findings : 'No detailed analysis available',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : []
    };

    console.log(`✅ Analysis complete for ${criteriaId}:`, validatedResult);
    return validatedResult;
    
  } catch (error) {
    console.error('❌ OpenAI API Error for criteria', criteriaId, ':', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error(language === 'ar' 
          ? 'مفتاح OpenAI API غير صحيح أو مفقود'
          : 'OpenAI API key is invalid or missing');
      } else if (error.message.includes('quota')) {
        throw new Error(language === 'ar' 
          ? 'تم تجاوز حد استخدام OpenAI API'
          : 'OpenAI API quota exceeded');
      } else if (error.message.includes('JSON')) {
        throw new Error(language === 'ar' 
          ? 'خطأ في تحليل استجابة الذكاء الاصطناعي'
          : 'Error parsing AI response');
      }
    }
    
    throw new Error(language === 'ar' 
      ? 'فشل في تحليل الوثيقة. يرجى التحقق من الاتصال بالإنترنت ومفتاح API.'
      : 'Failed to analyze document. Please check your internet connection and API key.');
  }
}

// Keep existing functions for backward compatibility
export async function analyzeDocument(documentText: string, language: 'ar' | 'en'): Promise<AnalysisResult> {
  // Existing implementation...
  try {
    const prompt = language === 'ar' ? DGA_STANDARD_PROMPT_AR : DGA_STANDARD_PROMPT_EN;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: `${language === 'ar' ? 'يرجى تحليل هذه الوثيقة للامتثال لمعيار هيئة الحكومة الرقمية 5.4. لغة الوثيقة' : 'Please analyze this document for DGA Standard 5.4 compliance. Document language'}: ${language}\n\n${language === 'ar' ? 'محتوى الوثيقة' : 'Document content'}:\n${documentText}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as AnalysisResult;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(language === 'ar' 
      ? 'فشل في تحليل الوثيقة. يرجى التحقق من مفتاح API والمحاولة مرة أخرى.'
      : 'Failed to analyze document. Please check your API key and try again.');
  }
}

const DGA_STANDARD_PROMPT_AR = `
أنت خبير مدقق لمعيار هيئة الحكومة الرقمية السعودية 5.4 "الثقافة والبيئة الرقمية".

قم بتحليل الوثيقة المقدمة مقابل هذه المتطلبات الأساسية:

5.4.1 - دراسات وبرامج الوعي بالتحول الرقمي
5.4.2 - تنفيذ وتقييم برامج رفع الوعي
5.4.3 - استخدام ودعم الأدوات التقنية
5.4.4 - التطوير المستمر للثقافة الرقمية

أرجع استجابة JSON بهذا الهيكل:
{
  "overallScore": number,
  "language": "ar",
  "requirements": [...],
  "summary": "تقييم شامل",
  "criticalIssues": ["قضية1", "قضية2"]
}
`;

const DGA_STANDARD_PROMPT_EN = `
You are an expert auditor for Saudi Arabia's Digital Governance Authority (DGA) Standard 5.4 "Digital Culture and Environment".

Analyze the provided document against these main requirements:

5.4.1 - Digital Transformation Awareness Studies and Programs
5.4.2 - Implementation and Evaluation of Awareness Programs
5.4.3 - Use and Support of Technical Tools
5.4.4 - Continuous Development of Digital Culture

Return a JSON response with this structure:
{
  "overallScore": number,
  "language": "en",
  "requirements": [...],
  "summary": "overall assessment",
  "criticalIssues": ["issue1", "issue2"]
}
`;

export async function checkApiKey(): Promise<boolean> {
  try {
    await openai.models.list();
    return true;
  } catch (error) {
    console.error('API Key validation failed:', error);
    return false;
  }
}
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

const IMPROVED_CRITERIA_PROMPTS = {
  '5.4.1': {
    ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.1: "دراسات وبرامج الوعي بالتحول الرقمي"

المتطلب: إعداد دراسات لتحديد مستوى وعي منسوبي الجهة بعملية التحول الرقمي وإعداد البرامج التوعوية اللازمة لزيادة الوعي والثقافة الرقمية في بيئة العمل.

ابحث عن أي من هذه العناصر (لا يجب أن تكون جميعها موجودة):

الدراسات والتقييمات:
- أي دراسة أو تقييم لمستوى الوعي الرقمي
- استطلاعات أو مسوحات للموظفين حول التقنية
- تحليل احتياجات التدريب الرقمي
- تقييم المهارات التقنية الحالية
- دراسات الفجوات في المعرفة الرقمية

البرامج والمبادرات التوعوية:
- أي برنامج تدريبي أو توعوي متعلق بالتقنية
- ورش عمل أو دورات حول الأدوات الرقمية
- حملات توعوية داخلية
- مواد تعليمية أو إرشادية رقمية
- منصات تعلم إلكتروني أو محتوى تدريبي

مؤشرات التخطيط:
- خطط لتطوير الوعي الرقمي
- أهداف متعلقة بالثقافة الرقمية
- مبادرات لتحسين المهارات التقنية

كن متساهلاً في التقييم - إذا وجدت أي إشارة لهذه العناصر، حتى لو كانت بسيطة، فهذا يعتبر تقدماً إيجابياً.

الكلمات المفتاحية: التدريب، التطوير، المهارات، التقنية، الرقمي، الوعي، البرامج، الدورات، ورش العمل، التعلم، المعرفة، القدرات`,
    en: `You are an expert auditor specialized in evaluating requirement 5.4.1: "Digital Transformation Awareness Studies and Programs"

Requirement: Conduct studies to determine agency staff awareness levels of digital transformation and develop necessary awareness programs to increase digital awareness and culture in the work environment.

Look for any of these elements (not all need to be present):

Studies and Assessments:
- Any study or assessment of digital awareness levels
- Employee surveys about technology
- Digital training needs analysis
- Current technical skills evaluation
- Digital knowledge gap studies

Awareness Programs and Initiatives:
- Any training or awareness program related to technology
- Workshops or courses on digital tools
- Internal awareness campaigns
- Digital educational or guidance materials
- E-learning platforms or training content

Planning Indicators:
- Plans to develop digital awareness
- Objectives related to digital culture
- Initiatives to improve technical skills

Be lenient in evaluation - if you find any reference to these elements, even if simple, this counts as positive progress.

Keywords: training, development, skills, technology, digital, awareness, programs, courses, workshops, learning, knowledge, capabilities`
  },
  '5.4.2': {
    ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.2: "تنفيذ وتقييم برامج رفع الوعي"

المتطلب: تنفيذ البرامج المعتمدة لزيادة وعي منسوبي الجهة بعملية التحول الرقمي وقياس نسب إنجازها وتقييم فعاليتها وتحديثها بشكل دوري.

ابحث عن أي من هذه العناصر:

التنفيذ والتطبيق:
- تطبيق أي برامج تدريبية أو توعوية
- تنفيذ ورش عمل أو دورات
- إجراء أنشطة تطويرية للموظفين
- تفعيل مبادرات التعلم والتطوير

القياس والمتابعة:
- أي إحصائيات أو أرقام حول التدريب
- معدلات المشاركة أو الحضور
- تقارير عن الأنشطة التدريبية
- مؤشرات الأداء أو النتائج

التقييم والمراجعة:
- تقييم أثر البرامج التدريبية
- مراجعة فعالية الأنشطة
- تحليل النتائج أو المخرجات
- تحديث أو تطوير البرامج

كن متساهلاً - أي دليل على تنفيذ أو قياس أو تقييم للأنشطة التدريبية يعتبر إيجابياً.

الكلمات المفتاحية: التنفيذ، التطبيق، القياس، التقييم، المتابعة، النتائج، الإحصائيات، المشاركة، الفعالية، التحديث`,
    en: `You are an expert auditor specialized in evaluating requirement 5.4.2: "Implementation and Evaluation of Awareness Programs"

Requirement: Implement approved programs to increase agency staff awareness of digital transformation, measure achievement rates, evaluate effectiveness, and update them periodically.

Look for any of these elements:

Implementation and Execution:
- Implementation of any training or awareness programs
- Conducting workshops or courses
- Carrying out employee development activities
- Activating learning and development initiatives

Measurement and Monitoring:
- Any statistics or numbers about training
- Participation or attendance rates
- Reports on training activities
- Performance indicators or results

Evaluation and Review:
- Evaluation of training program impact
- Review of activity effectiveness
- Analysis of results or outputs
- Updates or development of programs

Be lenient - any evidence of implementing, measuring, or evaluating training activities counts as positive.

Keywords: implementation, execution, measurement, evaluation, monitoring, results, statistics, participation, effectiveness, updates`
  },
  '5.4.3': {
    ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.3: "استخدام ودعم الأدوات التقنية"

المتطلب: تحسين استخدام الأدوات التقنية في أعمال منسوبي الجهة وتنظيم ورش التدريب وإنشاء قنوات الدعم التقني وقياس مستوى اعتماد الأدوات الرقمية.

ابحث عن أي من هذه العناصر:

الأدوات والأنظمة التقنية:
- أي أنظمة أو برمجيات مستخدمة في العمل
- منصات رقمية أو تطبيقات
- أدوات الإنتاجية أو التعاون
- تقنيات حديثة أو حلول رقمية

التدريب والدعم:
- تدريب على استخدام الأدوات التقنية
- دعم فني أو مساعدة تقنية
- أدلة استخدام أو مواد مساعدة
- فرق دعم أو مراكز مساعدة

الاستخدام والاعتماد:
- استخدام الأدوات في العمل اليومي
- اعتماد تقنيات جديدة
- تحسين العمليات بالتقنية
- قياس الاستخدام أو الفعالية

كن متساهلاً - أي ذكر لاستخدام التقنية أو الأدوات الرقمية في العمل يعتبر إيجابياً.

الكلمات المفتاحية: الأنظمة، البرمجيات، التطبيقات، المنصات، الأدوات، التقنية، الدعم، التدريب، الاستخدام، الاعتماد`,
    en: `You are an expert auditor specialized in evaluating requirement 5.4.3: "Use and Support of Technical Tools"

Requirement: Improve the use of technical tools in agency staff work, organize training workshops, establish technical support channels, and measure digital tools adoption levels.

Look for any of these elements:

Technical Tools and Systems:
- Any systems or software used in work
- Digital platforms or applications
- Productivity or collaboration tools
- Modern technologies or digital solutions

Training and Support:
- Training on using technical tools
- Technical support or assistance
- User guides or help materials
- Support teams or help centers

Usage and Adoption:
- Using tools in daily work
- Adopting new technologies
- Improving processes with technology
- Measuring usage or effectiveness

Be lenient - any mention of using technology or digital tools in work counts as positive.

Keywords: systems, software, applications, platforms, tools, technology, support, training, usage, adoption`
  },
  '5.4.4': {
    ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.4: "التطوير المستمر للثقافة الرقمية"

المتطلب: وضع استراتيجيات وخطط للتطوير المستمر للثقافة الرقمية في الجهة ومتابعة تطبيقها وقياس أثرها على الأداء العام والتحسين المستمر.

ابحث عن أي من هذه العناصر:

الاستراتيجيات والخطط:
- أي استراتيجية أو خطة للتطوير
- رؤية أو أهداف مستقبلية
- مبادرات التحسين أو التطوير
- خطط طويلة المدى أو قصيرة المدى

المتابعة والتطبيق:
- متابعة تنفيذ الخطط أو المبادرات
- مراجعة دورية للأنشطة
- تقارير عن التقدم أو الإنجازات
- آليات المتابعة والمراقبة

قياس الأثر والتحسين:
- قياس أثر التطوير على الأداء
- مؤشرات التحسن أو النجاح
- عمليات التحسين المستمر
- تطوير القدرات أو الممارسات

كن متساهلاً - أي إشارة للتخطيط المستقبلي أو التطوير أو التحسين يعتبر إيجابياً.

الكلمات المفتاحية: الاستراتيجية، الخطة، التطوير، التحسين، المستقبل، الأهداف، المبادرات، التقدم، الأثر، النجاح`,
    en: `You are an expert auditor specialized in evaluating requirement 5.4.4: "Continuous Development of Digital Culture"

Requirement: Develop strategies and plans for continuous development of digital culture in the agency, monitor their implementation, and measure their impact on overall performance and continuous improvement.

Look for any of these elements:

Strategies and Plans:
- Any strategy or plan for development
- Vision or future objectives
- Improvement or development initiatives
- Long-term or short-term plans

Monitoring and Implementation:
- Monitoring plan or initiative implementation
- Periodic review of activities
- Reports on progress or achievements
- Monitoring and oversight mechanisms

Impact Measurement and Improvement:
- Measuring development impact on performance
- Improvement or success indicators
- Continuous improvement processes
- Capacity or practice development

Be lenient - any reference to future planning, development, or improvement counts as positive.

Keywords: strategy, plan, development, improvement, future, objectives, initiatives, progress, impact, success`
  }
};

export async function analyzeDocumentForCriteria(
  documentText: string, 
  criteriaId: string, 
  language: 'ar' | 'en'
): Promise<CriteriaAnalysis> {
  try {
    const prompt = IMPROVED_CRITERIA_PROMPTS[criteriaId as keyof typeof IMPROVED_CRITERIA_PROMPTS];
    if (!prompt) {
      throw new Error(`Unknown criteria ID: ${criteriaId}`);
    }

    const criteriaPrompt = prompt[language];
    
    const systemPrompt = language === 'ar' ? `
${criteriaPrompt}

قم بتحليل الوثيقة بعقلية إيجابية ومتساهلة. هذه وثيقة حقيقية مقدمة من وزارة للهيئة، لذا ابحث عن أي دليل إيجابي حتى لو كان بسيطاً.

معايير التقييم المتساهلة:
- وجود أي إشارة للمتطلب (50%): هل يوجد أي ذكر أو إشارة لهذا المتطلب؟
- مستوى التفصيل (30%): هل التفاصيل كافية أم تحتاج تطوير؟
- وضوح التنفيذ (20%): هل التنفيذ واضح أم يحتاج توضيح؟

نظام التقييم المحدث:
- "pass": 60+ نقطة - يوجد دليل واضح على تلبية المتطلب (حتى لو بسيط)
- "partial": 30-59 نقطة - يوجد إشارة للمتطلب لكن تحتاج تطوير
- "fail": أقل من 30 نقطة - لا يوجد أي إشارة واضحة للمتطلب

كن إيجابياً ومشجعاً في تحليلك. ابحث عن نقاط القوة أولاً.

أرجع استجابة JSON بهذا الهيكل:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "evidence": ["اقتباس محدد 1", "اقتباس محدد 2", "اقتباس محدد 3"],
  "findings": "تحليل إيجابي ومتوازن يبرز نقاط القوة أولاً ثم يذكر فرص التحسين",
  "recommendations": ["توصية بناءة 1", "توصية بناءة 2", "توصية بناءة 3"]
}
` : `
${criteriaPrompt}

Analyze the document with a positive and lenient mindset. This is a real document submitted by a ministry to DGA, so look for any positive evidence even if simple.

Lenient Evaluation Criteria:
- Any reference to the requirement (50%): Is there any mention or reference to this requirement?
- Level of detail (30%): Are the details sufficient or need development?
- Implementation clarity (20%): Is implementation clear or needs clarification?

Updated Scoring System:
- "pass": 60+ points - Clear evidence of meeting the requirement (even if simple)
- "partial": 30-59 points - Reference to requirement but needs development
- "fail": Less than 30 points - No clear reference to the requirement

Be positive and encouraging in your analysis. Look for strengths first.

Return a JSON response with this structure:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "evidence": ["specific quote 1", "specific quote 2", "specific quote 3"],
  "findings": "positive and balanced analysis highlighting strengths first then improvement opportunities",
  "recommendations": ["constructive recommendation 1", "constructive recommendation 2", "constructive recommendation 3"]
}
`;

    // Limit document text to prevent token overflow
    const maxTextLength = 35000;
    let limitedText = documentText;
    if (documentText.length > maxTextLength) {
      limitedText = documentText.substring(0, maxTextLength) + '\n\n[Text truncated due to length...]';
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
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
      temperature: 0.2, // Slightly higher for more nuanced analysis
      max_tokens: 2000,
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
      console.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from OpenAI API');
    }
    
    // Validate the result has required fields with default values
    const validatedResult: CriteriaAnalysis = {
      score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 0,
      status: ['pass', 'fail', 'partial'].includes(result.status) ? result.status : 'fail',
      confidence: typeof result.confidence === 'number' ? Math.max(70, Math.min(95, result.confidence)) : 75,
      evidence: Array.isArray(result.evidence) ? result.evidence.slice(0, 5) : [],
      findings: typeof result.findings === 'string' ? result.findings : 'No analysis available',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : []
    };

    // Additional validation to ensure we have meaningful data
    if (!validatedResult.findings || validatedResult.findings === 'No analysis available') {
      throw new Error('Analysis result missing required findings');
    }
    
    return validatedResult;
  } catch (error) {
    console.error('OpenAI API Error for criteria', criteriaId, ':', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        throw new Error(language === 'ar' 
          ? 'خطأ في تحليل استجابة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.'
          : 'Error parsing AI response. Please try again.');
      } else if (error.message.includes('API')) {
        throw new Error(language === 'ar' 
          ? 'فشل في الاتصال بخدمة الذكاء الاصطناعي. يرجى التحقق من مفتاح API.'
          : 'Failed to connect to AI service. Please check your API key.');
      }
    }
    
    throw new Error(language === 'ar' 
      ? 'فشل في تحليل الوثيقة. يرجى التحقق من مفتاح API والمحاولة مرة أخرى.'
      : 'Failed to analyze document. Please check your API key and try again.');
  }
}

export async function analyzeDocument(documentText: string, language: 'ar' | 'en'): Promise<AnalysisResult> {
  try {
    const prompt = language === 'ar' ? DGA_STANDARD_PROMPT_AR : DGA_STANDARD_PROMPT_EN;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
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

الكلمات المفتاحية العربية للبحث عنها:
- الثقافة الرقمية، التحول الرقمي، الوعي الرقمي
- التدريب، ورش العمل، البرامج التوعوية
- التنفيذ، التطبيق، القياس، التقييم
- الأدوات التقنية، الأدوات الرقمية، التقنيات الحديثة
- الدعم التقني، المساعدة التقنية، الإرشاد التقني
- التطوير المستمر، الاستراتيجيات، التحسين
- المنسوبون، الموظفون، الكوادر البشرية
- الجهة الحكومية، المؤسسة، الوزارة

لكل متطلب، قدم:
1. الحالة: "pass" أو "fail" أو "partial"
2. درجة الثقة (0-100%)
3. اقتباسات الأدلة من الوثيقة
4. النتائج التفصيلية
5. توصيات محددة للتحسين

أرجع استجابة JSON بهذا الهيكل:
{
  "overallScore": number,
  "language": "ar",
  "requirements": [
    {
      "requirementId": "5.4.1",
      "status": "pass" | "fail" | "partial",
      "confidence": number,
      "evidence": ["اقتباس1", "اقتباس2"],
      "findings": "تحليل مفصل",
      "recommendations": ["توصية1", "توصية2"]
    }
  ],
  "summary": "تقييم شامل",
  "criticalIssues": ["قضية1", "قضية2"]
}

كن شاملاً وموضوعياً وقدم رؤى قابلة للتنفيذ. ادعم الوثائق العربية والإنجليزية.
`;

const DGA_STANDARD_PROMPT_EN = `
You are an expert auditor for Saudi Arabia's Digital Governance Authority (DGA) Standard 5.4 "Digital Culture and Environment".

Analyze the provided document against these main requirements:

5.4.1 - Digital Transformation Awareness Studies and Programs
5.4.2 - Implementation and Evaluation of Awareness Programs
5.4.3 - Use and Support of Technical Tools
5.4.4 - Continuous Development of Digital Culture

English keywords to search for:
- Digital culture, digital transformation, digital awareness
- Training, workshops, awareness programs
- Implementation, execution, measurement, evaluation
- Technical tools, digital tools, modern technologies
- Technical support, technical assistance, technical guidance
- Continuous development, strategies, improvement
- Staff, employees, human resources
- Government agency, institution, ministry

For each requirement, provide:
1. Status: "pass", "fail", or "partial"
2. Confidence score (0-100%)
3. Evidence quotes from the document
4. Detailed findings
5. Specific recommendations for improvement

Return a JSON response with this structure:
{
  "overallScore": number,
  "language": "en",
  "requirements": [
    {
      "requirementId": "5.4.1",
      "status": "pass" | "fail" | "partial",
      "confidence": number,
      "evidence": ["quote1", "quote2"],
      "findings": "detailed analysis",
      "recommendations": ["recommendation1", "recommendation2"]
    }
  ],
  "summary": "overall assessment",
  "criticalIssues": ["issue1", "issue2"]
}

Be thorough, objective, and provide actionable insights. Support both Arabic and English documents.
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
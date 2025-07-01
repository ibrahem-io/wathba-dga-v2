import { BaseAgent } from './BaseAgent';
import { ComplianceScore, Evidence, DocumentMetadata } from './types';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

interface ComplianceScorerInput {
  documentMetadata: DocumentMetadata;
  evidence: Evidence[];
  criteriaId: string;
  language: 'ar' | 'en';
}

export class ComplianceScorerAgent extends BaseAgent {
  private llm: ChatOpenAI | null = null;

  protected async onInitialize(): Promise<void> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 2000,
        openAIApiKey: apiKey,
      });
      
      console.log(`Compliance Scorer Agent ${this.config.id} initialized`);
    } catch (error) {
      console.error(`Failed to initialize LLM for agent ${this.config.id}:`, error);
      throw error;
    }
  }

  protected async onExecute(input: ComplianceScorerInput): Promise<ComplianceScore> {
    const { documentMetadata, evidence, criteriaId, language } = input;

    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    try {
      // If we have very little content, do a basic text analysis instead of relying only on evidence
      const shouldAnalyzeFullText = evidence.length === 0 || documentMetadata.wordCount < 50;
      
      if (shouldAnalyzeFullText && documentMetadata.extractedText.length > 20) {
        console.log(`Performing full text analysis for criteria ${criteriaId} due to limited evidence`);
        return await this.analyzeFullText(documentMetadata, criteriaId, language);
      }

      const prompt = this.buildPrompt(criteriaId, language, documentMetadata, evidence);
      
      const messages = [
        new SystemMessage(prompt.system),
        new HumanMessage(prompt.user)
      ];

      console.log(`Scoring compliance for criteria ${criteriaId} with ${evidence.length} evidence pieces`);
      
      const response = await this.llm.invoke(messages);
      const result = this.parseResponse(response.content as string, criteriaId, evidence);

      console.log(`Compliance scoring completed for criteria ${criteriaId}: ${result.status} (${result.score}%)`);
      return result;

    } catch (error) {
      console.error(`Compliance scoring failed for criteria ${criteriaId}:`, error);
      
      // Try full text analysis as fallback if we have content
      if (documentMetadata.extractedText.length > 20) {
        console.log(`Attempting full text analysis as fallback for criteria ${criteriaId}`);
        try {
          return await this.analyzeFullText(documentMetadata, criteriaId, language);
        } catch (fallbackError) {
          console.error(`Full text analysis also failed:`, fallbackError);
        }
      }
      
      // Final fallback
      return this.createFallbackScore(criteriaId, evidence, language, documentMetadata);
    }
  }

  private async analyzeFullText(
    metadata: DocumentMetadata, 
    criteriaId: string, 
    language: 'ar' | 'en'
  ): Promise<ComplianceScore> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    const systemPrompt = this.getDetailedAuditPrompt(criteriaId, language);

    // Limit text to prevent token overflow
    const maxTextLength = 8000;
    const textToAnalyze = metadata.extractedText.length > maxTextLength 
      ? metadata.extractedText.substring(0, maxTextLength) + '...'
      : metadata.extractedText;

    const userPrompt = language === 'ar' ? `
الوثيقة: ${metadata.filename}
عدد الكلمات: ${metadata.wordCount}

النص الكامل للتحليل:
${textToAnalyze}

قم بتحليل هذا النص للبحث عن أي دليل على الامتثال للمتطلب ${criteriaId} وفقاً للإرشادات التفصيلية المحددة.
` : `
Document: ${metadata.filename}
Word Count: ${metadata.wordCount}

Full text for analysis:
${textToAnalyze}

Analyze this text for any evidence of compliance with requirement ${criteriaId} according to the detailed guidelines specified.
`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ];

    const response = await this.llm.invoke(messages);
    return this.parseResponse(response.content as string, criteriaId, []);
  }

  private getDetailedAuditPrompt(criteriaId: string, language: 'ar' | 'en'): string {
    const prompts = {
      '5.4.1': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.1: "إعداد دراسات وبرامج لتعزيز الثقافة والبيئة الرقمية"

الهدف: تحديد مستوى وعي منسوبي الجهة الحكومية بالتحول الرقمي وإعداد الدراسات والبرامج اللازمة لزيادة هذا الوعي.

إطار التقييم الشامل:

المتطلب الأول: دراسة الوعي بالتحول الرقمي
ابحث عن:
- وجود وثيقة دراسة رسمية
- تقييم مستوى الوعي الحالي بالتحول الرقمي بين الموظفين
- فهم أهمية التحول الرقمي
- معرفة الموظفين بخطط ومبادرات التحول الرقمي
- الوعي بنسب الإنجاز/التقدم المحرز
- فهم مجالات/نطاقات التحول الرقمي
- تحديد الفجوات عبر المستويات التنظيمية المختلفة

معايير التقييم:
✅ مطابق: الدراسة تشمل جميع العناصر المطلوبة مع منهجية واضحة ونتائج
⚠️ مطابق جزئياً: الدراسة تغطي معظم العناصر لكن تفتقر للعمق في بعض المجالات
❌ غير مطابق: لا توجد دراسة أو الدراسة تفتقر لعناصر مطلوبة مهمة

العلامات التحذيرية:
- دراسات عامة غير محددة للتحول الرقمي
- دراسات أقدم من سنتين بدون تحديثات
- غياب تحليل الفجوات أو التوصيات

المتطلب الثاني: تطوير برامج التوعية
ابحث عن:
- تحديد واضح للمجموعات المستهدفة:
  * فئات/أقسام محددة من الموظفين
  * مستويات إدارية مختلفة
  * أهداف توعوية محددة لكل مجموعة
- استراتيجية التنفيذ:
  * قنوات وطرق التواصل المختارة
  * جدول زمني لتنفيذ البرنامج
  * خطط تخصيص الموارد

معايير التقييم:
✅ مطابق: برنامج شامل مع تحديد واضح لجميع العناصر
⚠️ مطابق جزئياً: البرنامج موجود لكن يفتقر لبعض العناصر الاستراتيجية
❌ غير مطابق: لا يوجد برنامج أو توثيق تخطيط غير كافٍ

قائمة مراجعة الأدلة المطلوبة:
- [ ] وثيقة دراسة الوعي الرسمية
- [ ] نتائج تحليل الفجوات
- [ ] توثيق برنامج التوعية
- [ ] تحديد المجموعات المستهدفة
- [ ] الجدول الزمني ومنهجية التنفيذ

الكلمات المفتاحية للبحث:
دراسات، دراسة، تحليل، تقييم، مسح، استطلاع، الوعي، التحول الرقمي، الثقافة الرقمية، المهارات الرقمية، برامج توعوية، برامج تدريبية، ورش عمل، دورات، التدريب، التطوير، التعلم، المعرفة

كن متساهلاً في التقييم - ابحث عن أي إشارة لهذه العناصر حتى لو كانت بسيطة.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل يوضح ما تم العثور عليه مع ربطه بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"]
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.1: "Preparing Studies and Programs for Enhancing Digital Culture and Environment"

Objective: Determine the level of digital transformation awareness among government entity employees and prepare necessary studies and programs to increase this awareness.

Comprehensive Assessment Framework:

Requirement 1: Digital Transformation Awareness Study
Look for:
- Existence of a formal study document
- Assessment of current digital transformation awareness level among employees
- Understanding of digital transformation importance
- Employee knowledge of digital transformation plans and initiatives
- Awareness of achievement rates/progress percentages
- Understanding of digital transformation domains/areas
- Gap identification across different organizational levels

Evaluation Criteria:
✅ COMPLIANT: Study includes all required elements with clear methodology and findings
⚠️ PARTIALLY COMPLIANT: Study covers most elements but lacks depth in some areas
❌ NON-COMPLIANT: No study exists or study lacks significant required elements

Red Flags:
- Generic studies not specific to digital transformation
- Studies older than 2 years without updates
- Missing gap analysis or recommendations

Requirement 2: Awareness Programs Development
Look for:
- Clear target groups definition:
  * Specific employee categories/departments
  * Different administrative levels
  * Targeted awareness objectives for each group
- Implementation strategy:
  * Selected communication channels and methods
  * Timeline for program implementation
  * Resource allocation plans

Evaluation Criteria:
✅ COMPLIANT: Comprehensive program with all elements clearly defined
⚠️ PARTIALLY COMPLIANT: Program exists but missing some strategic elements
❌ NON-COMPLIANT: No program or inadequate planning documentation

Evidence Requirements Checklist:
- [ ] Formal awareness study document
- [ ] Gap analysis results
- [ ] Awareness program documentation
- [ ] Target group identification
- [ ] Implementation timeline and methodology

Keywords to search for:
study, studies, analysis, assessment, survey, evaluation, awareness, digital transformation, digital culture, digital skills, awareness programs, training programs, workshops, courses, training, development, learning, knowledge

Be lenient in evaluation - look for any reference to these elements even if simple.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis explaining what was found linked to specific requirements",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"]
}`
      },
      '5.4.2': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.2: "تنفيذ برامج التوعية بالتحول الرقمي وقياس أثرها"

الهدف: تنفيذ البرامج المعتمدة لزيادة وعي الموظفين بالتحول الرقمي وقياس أثر هذه البرامج.

إطار التقييم الشامل:

المتطلب الأول: تنفيذ البرنامج
ابحث عن:
- أدلة على التنفيذ الفعلي للبرنامج
- أنشطة وفعاليات موثقة
- سجلات المشاركة والحضور

معايير التقييم:
- يجب أن تكون البرامج منفذة فعلياً وليس مجرد مخططة
- أدلة على أنشطة منتظمة/مستمرة
- تقديم متعدد الأشكال (ورش عمل، ندوات، محتوى رقمي)

المتطلب الثاني: ورش عمل الامتثال
ابحث عن:
- ورش عمل محددة حول الامتثال للوائح تقنية المعلومات والاتصالات
- محتوى يغطي القوانين والسياسات والإرشادات ذات الصلة
- سجلات الحضور ومواد التدريب

المتطلب الثالث: التواصل حول خطط التحول الرقمي
ابحث عن:
- فعاليات/جلسات تشرح خطط التحول الرقمي التنظيمية
- تقارير التقدم للموظفين
- نهج تواصل متعدد القنوات

المتطلب الرابع: التبني الرقمي بقيادة الإدارة
ابحث عن:
- أدلة على مشاركة القيادة في أنشطة التوعية
- مبادرات أو عروض تقديمية بقيادة القيادة
- توثيق مشاركة الإدارة العليا

المتطلب الخامس: المراقبة والتقارير
ابحث عن:
- تقارير تقدم منتظمة حول أنشطة التوعية
- إشراف اللجنة (لجنة المعاملات الإلكترونية/التحول الرقمي)
- خطط عمل تصحيحية بناءً على نتائج المراقبة

الأدلة المطلوبة (الحد الأدنى):
- [ ] 3 عينات من توثيق أنشطة التوعية
- [ ] 3 عينات من أدلة مشاركة القيادة
- [ ] عينة واحدة من تقارير التقدم ومحاضر اللجان
- [ ] توثيق الإجراءات التصحيحية المتخذة

معايير الجودة:
- يجب أن تكون الأدلة حديثة (خلال 12 شهراً)
- يجب أن تظهر الوثائق التنفيذ الفعلي وليس مجرد التخطيط
- ربط واضح بين الأنشطة وأهداف التحول الرقمي

الكلمات المفتاحية:
التنفيذ، التطبيق، تطبق، ينفذ، تم تنفيذ، قياس، مقاييس، مؤشرات، نسب الإنجاز، تقييم، تقييم الفعالية، مراجعة، تحديث، البرامج، الأنشطة، المبادرات

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"]
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.2: "Implementing Digital Transformation Awareness Programs and Measuring Their Impact"

Objective: Implement approved programs to increase employee awareness of digital transformation and measure the impact of these programs.

Comprehensive Assessment Framework:

Requirement 1: Program Implementation
Look for:
- Evidence of actual program execution
- Documented activities and events
- Participation records and attendance

Evaluation Standards:
- Programs must be actively implemented, not just planned
- Evidence of regular/ongoing activities
- Multiple format delivery (workshops, seminars, digital content)

Requirement 2: Compliance Training Workshops
Look for:
- Workshops specifically about IT and communications regulations compliance
- Content covering relevant laws, policies, and guidelines
- Attendance records and training materials

Requirement 3: Digital Transformation Plans Communication
Look for:
- Events/sessions explaining organizational digital transformation plans
- Progress reporting to employees
- Multi-channel communication approach

Requirement 4: Leadership-Driven Digital Adoption
Look for:
- Evidence of leadership participation in awareness activities
- Leadership-led initiatives or presentations
- Senior management engagement documentation

Requirement 5: Monitoring and Reporting
Look for:
- Regular progress reports on awareness activities
- Committee oversight (Electronic Transactions/Digital Transformation Committee)
- Corrective action plans based on monitoring results

Evidence Requirements (Minimum):
- [ ] 3 samples of awareness activities documentation
- [ ] 3 samples of leadership participation evidence
- [ ] 1 sample of progress reports and committee minutes
- [ ] Documentation of corrective actions taken

Quality Standards:
- Evidence must be recent (within 12 months)
- Documents must show actual implementation, not just planning
- Clear linkage between activities and digital transformation objectives

Keywords:
implementation, execute, implement, carried out, conducted, measurement, metrics, indicators, achievement rates, evaluation, effectiveness evaluation, review, update, programs, activities, initiatives

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis linking evidence to specific requirements",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"]
}`
      },
      '5.4.3': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.3: "استخدام الأدوات التقنية لمساعدة عمليات الجهة"

الهدف: تعزيز اعتماد الأدوات التقنية لتحسين أداء العمل اليومي والروتيني للموظفين.

إطار التقييم الشامل:

المتطلب الأول: آلية طلب البرمجيات والتراخيص
ابحث عن:
- عملية رسمية للموظفين لطلب الأدوات الرقمية/البرمجيات
- سير عمل موافقة واضح
- معايير أوقات الاستجابة
- تخصيص الميزانية لشراء الأدوات

معايير التقييم:
- يجب أن تكون العملية موثقة ومتاحة
- أدلة على طلبات فعلية تم معالجتها
- أوقات استجابة معقولة

المتطلب الثاني: برامج التدريب على الأدوات الرقمية
ابحث عن:
- ورش عمل تدريبية مجدولة أو دورات قصيرة
- مواد ومناهج تدريبية
- مؤهلات المدربين
- تقييم فعالية التدريب

المتطلب الثالث: تدريب الأشخاص المخولين على أنظمة المعلومات
ابحث عن:
- سجلات تدريب لمستخدمي النظام المخولين
- برامج تدريب قائمة على الأدوار
- مكونات تدريب الأمان والامتثال
- التحقق من كفاءة المستخدم

الأدلة المطلوبة:
- [ ] آلية/عملية موثقة لطلبات الأدوات
- [ ] توثيق برنامج التدريب وسجلات الإكمال
- [ ] أدلة على استعداد الموظفين لاعتماد الأدوات
- [ ] سجلات تدريب استخدام النظام

الكلمات المفتاحية:
الأدوات التقنية، الأدوات الرقمية، التقنيات، الأنظمة، البرمجيات، التطبيقات، المنصات، الدعم التقني، المساعدة التقنية، التدريب التقني، الاستخدام، الاعتماد، التطبيق

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"]
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.3: "Using Technical Tools to Assist in Entity Operations"

Objective: Enhance adoption of technical tools to improve employees' daily and routine work performance.

Comprehensive Assessment Framework:

Requirement 1: Software and License Request Mechanism
Look for:
- Formal process for employees to request digital tools/software
- Clear approval workflow
- Response time standards
- Budget allocation for tool procurement

Evaluation Standards:
- Process must be documented and accessible
- Evidence of actual requests processed
- Reasonable response times

Requirement 2: Training Programs for Digital Tools
Look for:
- Scheduled training workshops or short courses
- Training materials and curricula
- Instructor qualifications
- Training effectiveness assessment

Requirement 3: Authorized Personnel Training on Information Systems
Look for:
- Training records for authorized system users
- Role-based training programs
- Security and compliance training components
- User competency verification

Evidence Requirements:
- [ ] Documented mechanism/process for tool requests
- [ ] Training program documentation and completion records
- [ ] Evidence of employee preparedness for tool adoption
- [ ] System usage training records

Keywords:
technical tools, digital tools, technologies, systems, software, applications, platforms, technical support, technical assistance, technical training, usage, adoption, utilization

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis linking evidence to specific requirements",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"]
}`
      },
      '5.4.4': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.4: "التطوير المستمر للثقافة الرقمية"

الهدف: وضع استراتيجيات وخطط للتطوير المستمر للثقافة الرقمية في الجهة ومتابعة تطبيقها وقياس أثرها على الأداء العام والتحسين المستمر.

إطار التقييم الشامل:

المتطلب الأول: الاستراتيجيات والخطط
ابحث عن:
- أي استراتيجية أو خطة للتطوير
- رؤية أو أهداف مستقبلية
- مبادرات التحسين أو التطوير
- خطط طويلة المدى أو قصيرة المدى

المتطلب الثاني: المتابعة والتطبيق
ابحث عن:
- متابعة تنفيذ الخطط أو المبادرات
- مراجعة دورية للأنشطة
- تقارير عن التقدم أو الإنجازات
- آليات المتابعة والمراقبة

المتطلب الثالث: قياس الأثر والتحسين
ابحث عن:
- قياس أثر التطوير على الأداء
- مؤشرات التحسن أو النجاح
- عمليات التحسين المستمر
- تطوير القدرات أو الممارسات

معايير التقييم:
✅ مطابق كامل: جميع المتطلبات مستوفاة مع أدلة شاملة
⚠️ مطابق جزئي: معظم المتطلبات مستوفاة لكن توجد فجوات
❌ غير مطابق: متطلبات مهمة غير مستوفاة أو لا توجد أدلة
🚫 غير قابل للتطبيق: الجهة تقدم توثيق إعفاء صحيح

معايير التصعيد:
صعّد للمراجعة الإضافية إذا:
- الوثائق تبدو مفبركة أو غير متسقة
- الأدلة تشير لجهود امتثال غير حقيقية
- فجوات كبيرة بين المزعوم والتنفيذ الفعلي
- الجهة تدعي الإعفاء بدون تخويل مناسب

الكلمات المفتاحية:
استراتيجية، استراتيجيات، خطة، خطط، التطوير المستمر، التحسين المستمر، التطوير، المتابعة، الرصد، المراقبة، قياس الأثر، تقييم الأثر، النتائج

كن متساهلاً - أي إشارة للتخطيط المستقبلي أو التطوير أو التحسين تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"]
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.4: "Continuous Development of Digital Culture"

Objective: Develop strategies and plans for continuous development of digital culture in the agency, monitor their implementation, and measure their impact on overall performance and continuous improvement.

Comprehensive Assessment Framework:

Requirement 1: Strategies and Plans
Look for:
- Any strategy or plan for development
- Vision or future objectives
- Improvement or development initiatives
- Long-term or short-term plans

Requirement 2: Monitoring and Implementation
Look for:
- Monitoring plan or initiative implementation
- Periodic review of activities
- Reports on progress or achievements
- Monitoring and oversight mechanisms

Requirement 3: Impact Measurement and Improvement
Look for:
- Measuring development impact on performance
- Improvement or success indicators
- Continuous improvement processes
- Capacity or practice development

Compliance Levels:
✅ FULL COMPLIANCE: All requirements met with comprehensive evidence
⚠️ PARTIAL COMPLIANCE: Most requirements met but some gaps exist
❌ NON-COMPLIANCE: Significant requirements not met or no evidence provided
🚫 NOT APPLICABLE: Entity provides valid exemption documentation

Escalation Criteria:
Escalate for further review if:
- Documentation appears fabricated or inconsistent
- Evidence suggests non-genuine compliance efforts
- Significant gaps exist between claimed and actual implementation
- Entity claims exemption without proper authorization

Keywords:
strategy, strategies, plan, plans, continuous development, continuous improvement, development, monitoring, tracking, oversight, impact measurement, impact assessment, results

Be lenient - any reference to future planning, development, or improvement counts as positive.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis linking evidence to specific requirements",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"]
}`
      }
    };

    return prompts[criteriaId as keyof typeof prompts]?.[language] || this.getGenericPrompt(criteriaId, language);
  }

  private getGenericPrompt(criteriaId: string, language: 'ar' | 'en'): string {
    return language === 'ar' ? `
أنت خبير مدقق متخصص في تقييم معايير هيئة الحكومة الرقمية السعودية.

قم بتحليل النص للبحث عن أدلة الامتثال للمتطلب ${criteriaId}.

كن شاملاً وموضوعياً في تقييمك وقدم رؤى قابلة للتنفيذ.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"]
}
` : `
You are an expert auditor specialized in evaluating Saudi Arabia's Digital Governance Authority standards.

Analyze the text for evidence of compliance with requirement ${criteriaId}.

Be thorough, objective, and provide actionable insights in your assessment.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}
`;
  }

  private buildPrompt(
    criteriaId: string, 
    language: 'ar' | 'en', 
    metadata: DocumentMetadata, 
    evidence: Evidence[]
  ) {
    const systemPrompt = this.getDetailedAuditPrompt(criteriaId, language);

    const evidenceText = evidence.length > 0 
      ? evidence.map((e, i) => `${i + 1}. ${e.text} (${language === 'ar' ? 'الصلة' : 'Relevance'}: ${Math.round(e.relevance * 100)}%)`).join('\n')
      : (language === 'ar' ? 'لا توجد أدلة مباشرة' : 'No direct evidence found');

    const userPrompt = language === 'ar' ? `
الوثيقة: ${metadata.filename}
اللغة: ${metadata.language}
عدد الكلمات: ${metadata.wordCount}
ثقة الاستخراج: ${metadata.confidence}%

الأدلة المستخرجة:
${evidenceText}

قم بتقييم الامتثال للمتطلب ${criteriaId} وفقاً للإرشادات التفصيلية المحددة.
` : `
Document: ${metadata.filename}
Language: ${metadata.language}
Word Count: ${metadata.wordCount}
Extraction Confidence: ${metadata.confidence}%

Extracted Evidence:
${evidenceText}

Evaluate compliance for requirement ${criteriaId} according to the detailed guidelines specified.
`;

    return {
      system: systemPrompt,
      user: userPrompt
    };
  }

  private parseResponse(content: string, criteriaId: string, evidence: Evidence[]): ComplianceScore {
    try {
      // Clean the content by removing markdown code block delimiters
      let cleanedContent = content.trim();
      
      // Remove leading ```json or ``` and trailing ```
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.substring(7);
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.substring(3);
      }
      
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3);
      }
      
      // Trim any remaining whitespace
      cleanedContent = cleanedContent.trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      return {
        criteriaId,
        score: Math.max(0, Math.min(100, parsed.score || 0)),
        status: ['pass', 'fail', 'partial'].includes(parsed.status) ? parsed.status : 'fail',
        confidence: Math.max(70, Math.min(95, parsed.confidence || 75)),
        evidence,
        findings: parsed.findings || 'No detailed findings available',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : []
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.log('Raw response:', content);
      throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createFallbackScore(
    criteriaId: string, 
    evidence: Evidence[], 
    language: 'ar' | 'en',
    metadata: DocumentMetadata
  ): ComplianceScore {
    // Simple fallback scoring based on evidence
    const evidenceCount = evidence.length;
    const avgRelevance = evidence.length > 0 
      ? evidence.reduce((sum, e) => sum + e.relevance, 0) / evidence.length 
      : 0;

    let score = 0;
    let status: 'pass' | 'fail' | 'partial' = 'fail';

    if (evidenceCount >= 3 && avgRelevance > 0.7) {
      score = 75;
      status = 'pass';
    } else if (evidenceCount >= 2 && avgRelevance > 0.5) {
      score = 60;
      status = 'pass';
    } else if (evidenceCount >= 1 && avgRelevance > 0.4) {
      score = 45;
      status = 'partial';
    } else if (metadata.wordCount > 100) {
      score = 25;
      status = 'partial';
    } else {
      score = 15;
      status = 'fail';
    }

    const findings = language === 'ar' 
      ? `تم العثور على ${evidenceCount} دليل بمتوسط صلة ${Math.round(avgRelevance * 100)}%. الوثيقة تحتوي على ${metadata.wordCount} كلمة. التقييم الآلي بسبب عدم توفر التحليل المتقدم.`
      : `Found ${evidenceCount} evidence pieces with average relevance ${Math.round(avgRelevance * 100)}%. Document contains ${metadata.wordCount} words. Automated assessment due to unavailable advanced analysis.`;

    const recommendations = language === 'ar' 
      ? [
          'تحسين توثيق الأنشطة المتعلقة بالمتطلب',
          'إضافة تفاصيل أكثر حول التطبيق العملي',
          'تطوير آليات القياس والمتابعة'
        ]
      : [
          'Improve documentation of requirement-related activities',
          'Add more details about practical implementation',
          'Develop measurement and monitoring mechanisms'
        ];

    return {
      criteriaId,
      score,
      status,
      confidence: 70,
      evidence,
      findings,
      recommendations
    };
  }
}
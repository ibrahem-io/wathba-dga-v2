export interface ChecklistItem {
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

export const defaultComplianceItems: ChecklistItem[] = [
  {
    id: '5.4.1.1',
    titleAr: '5.4.1.1 - دراسات وبرامج الوعي بالتحول الرقمي',
    titleEn: '5.4.1.1 - Digital Transformation Awareness Studies and Programs',
    descriptionAr: 'إعداد دراسة لتحديد مستوى وعي منسوبي الجهة بعملية التحول الرقمي وإعداد الدراسات والبرامج اللازمة لزيادة هذا الوعي والثقافة الرقمية',
    descriptionEn: 'Conduct studies to determine the level of agency staff awareness of digital transformation and prepare necessary studies and programs to increase this awareness and digital culture',
    status: 'pending'
  },
  {
    id: '5.4.1.2',
    titleAr: '5.4.1.2 - برامج توعوية للثقافة الرقمية',
    titleEn: '5.4.1.2 - Digital Culture Awareness Programs',
    descriptionAr: 'إعداد برامج توعوية لمنسوبي الجهة الحكومية بأهمية عمليات التحول الرقمي وتعزيز الثقافة الرقمية في بيئة العمل',
    descriptionEn: 'Develop awareness programs for government agency staff about the importance of digital transformation processes and promoting digital culture in the work environment',
    status: 'pending'
  },
  {
    id: '5.4.2.1',
    titleAr: '5.4.2.1 - تنفيذ برامج رفع الوعي وقياس الأثر',
    titleEn: '5.4.2.1 - Implementation of Awareness Programs and Impact Measurement',
    descriptionAr: 'تنفيذ البرامج المعتمدة لزيادة وعي منسوبي الجهة بعملية التحول الرقمي وقياس نسب إنجازها ومجالات التحول الرقمي والثقافة الرقمية',
    descriptionEn: 'Implement approved programs to increase agency staff awareness of digital transformation and measure achievement rates and digital transformation areas and digital culture',
    status: 'pending'
  },
  {
    id: '5.4.2.2',
    titleAr: '5.4.2.2 - تقييم وتحسين البرامج التوعوية',
    titleEn: '5.4.2.2 - Evaluation and Improvement of Awareness Programs',
    descriptionAr: 'تقييم فعالية البرامج التوعوية للثقافة الرقمية وتحديثها بشكل دوري بناءً على التغذية الراجعة والنتائج المحققة',
    descriptionEn: 'Evaluate the effectiveness of digital culture awareness programs and update them periodically based on feedback and achieved results',
    status: 'pending'
  },
  {
    id: '5.4.3.1',
    titleAr: '5.4.3.1 - استخدام الأدوات التقنية في أعمال الجهة',
    titleEn: '5.4.3.1 - Use of Technical Tools in Agency Operations',
    descriptionAr: 'تقرير نسب الأدوات التقنية لتحسين أعمال منسوبي الجهة بوضع آليات أو توجيهات أو سياسات يستخدمها المنسوبون في أعمالهم اليومية',
    descriptionEn: 'Report technical tools ratios for improving agency staff work by establishing mechanisms, guidelines, or policies used by staff in their daily operations',
    status: 'pending'
  },
  {
    id: '5.4.3.2',
    titleAr: '5.4.3.2 - تنظيم ورش التدريب لدعم الأدوات الرقمية',
    titleEn: '5.4.3.2 - Organizing Training Workshops for Digital Tools Support',
    descriptionAr: 'تنظيم ورش التدريب للموظفين بمختلف الوحدات والمستويات الإدارية لزيادة الوعي بالتحول الرقمي وسبل تنفيذها وتعزيز الثقافة الرقمية',
    descriptionEn: 'Organize training workshops for employees across different units and administrative levels to increase digital transformation awareness and implementation methods and promote digital culture',
    status: 'pending'
  },
  {
    id: '5.4.3.3',
    titleAr: '5.4.3.3 - إنشاء قنوات الدعم التقني الفعالة',
    titleEn: '5.4.3.3 - Establishing Effective Technical Support Channels',
    descriptionAr: 'إنشاء قنوات الدعم التقني المتاحة للموظفين لحل المشاكل التقنية وتقديم الإرشادات اللازمة لتعزيز استخدام الأدوات الرقمية',
    descriptionEn: 'Establish technical support channels available to employees for solving technical problems and providing necessary guidance to enhance digital tools usage',
    status: 'pending'
  },
  {
    id: '5.4.3.4',
    titleAr: '5.4.3.4 - قياس مستوى اعتماد الأدوات الرقمية',
    titleEn: '5.4.3.4 - Measuring Digital Tools Adoption Level',
    descriptionAr: 'قياس ومراقبة مستوى اعتماد الموظفين للأدوات الرقمية في أعمالهم اليومية وتحديد مجالات التحسين في الثقافة الرقمية',
    descriptionEn: 'Measure and monitor the level of employee adoption of digital tools in their daily work and identify areas for improvement in digital culture',
    status: 'pending'
  }
];
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
    id: '5.4.1',
    titleAr: '5.4.1 - دراسات وبرامج الوعي بالتحول الرقمي',
    titleEn: '5.4.1 - Digital Transformation Awareness Studies and Programs',
    descriptionAr: 'إعداد دراسات لتحديد مستوى وعي منسوبي الجهة بعملية التحول الرقمي وإعداد البرامج التوعوية اللازمة لزيادة الوعي والثقافة الرقمية في بيئة العمل',
    descriptionEn: 'Conduct studies to determine agency staff awareness levels of digital transformation and develop necessary awareness programs to increase digital awareness and culture in the work environment',
    status: 'pending'
  },
  {
    id: '5.4.2',
    titleAr: '5.4.2 - تنفيذ وتقييم برامج رفع الوعي',
    titleEn: '5.4.2 - Implementation and Evaluation of Awareness Programs',
    descriptionAr: 'تنفيذ البرامج المعتمدة لزيادة وعي منسوبي الجهة بعملية التحول الرقمي وقياس نسب إنجازها وتقييم فعاليتها وتحديثها بشكل دوري',
    descriptionEn: 'Implement approved programs to increase agency staff awareness of digital transformation, measure achievement rates, evaluate effectiveness, and update them periodically',
    status: 'pending'
  },
  {
    id: '5.4.3',
    titleAr: '5.4.3 - استخدام ودعم الأدوات التقنية',
    titleEn: '5.4.3 - Use and Support of Technical Tools',
    descriptionAr: 'تحسين استخدام الأدوات التقنية في أعمال منسوبي الجهة وتنظيم ورش التدريب وإنشاء قنوات الدعم التقني وقياس مستوى اعتماد الأدوات الرقمية',
    descriptionEn: 'Improve the use of technical tools in agency staff work, organize training workshops, establish technical support channels, and measure digital tools adoption levels',
    status: 'pending'
  },
  {
    id: '5.4.4',
    titleAr: '5.4.4 - التطوير المستمر للثقافة الرقمية',
    titleEn: '5.4.4 - Continuous Development of Digital Culture',
    descriptionAr: 'وضع استراتيجيات وخطط للتطوير المستمر للثقافة الرقمية في الجهة ومتابعة تطبيقها وقياس أثرها على الأداء العام والتحسين المستمر',
    descriptionEn: 'Develop strategies and plans for continuous development of digital culture in the agency, monitor their implementation, and measure their impact on overall performance and continuous improvement',
    status: 'pending'
  }
];
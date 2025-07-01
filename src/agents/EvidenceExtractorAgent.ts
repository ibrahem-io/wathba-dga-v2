import { BaseAgent } from './BaseAgent';
import { Evidence, DocumentMetadata } from './types';

interface EvidenceExtractorInput {
  documentMetadata: DocumentMetadata;
  criteriaId: string;
  language: 'ar' | 'en';
}

export class EvidenceExtractorAgent extends BaseAgent {
  private criteriaKeywords: Record<string, { ar: string[], en: string[] }> = {
    '5.4.1': {
      ar: [
        'دراسات', 'دراسة', 'تحليل', 'تقييم', 'مسح', 'استطلاع',
        'الوعي', 'التحول الرقمي', 'الثقافة الرقمية', 'المهارات الرقمية',
        'برامج توعوية', 'برامج تدريبية', 'ورش عمل', 'دورات',
        'التدريب', 'التطوير', 'التعلم', 'المعرفة'
      ],
      en: [
        'study', 'studies', 'analysis', 'assessment', 'survey', 'evaluation',
        'awareness', 'digital transformation', 'digital culture', 'digital skills',
        'awareness programs', 'training programs', 'workshops', 'courses',
        'training', 'development', 'learning', 'knowledge'
      ]
    },
    '5.4.2': {
      ar: [
        'تنفيذ', 'تطبيق', 'تطبق', 'ينفذ', 'تم تنفيذ',
        'قياس', 'مقاييس', 'مؤشرات', 'نسب الإنجاز',
        'تقييم', 'تقييم الفعالية', 'مراجعة', 'تحديث',
        'البرامج', 'الأنشطة', 'المبادرات'
      ],
      en: [
        'implementation', 'execute', 'implement', 'carried out', 'conducted',
        'measurement', 'metrics', 'indicators', 'achievement rates',
        'evaluation', 'effectiveness evaluation', 'review', 'update',
        'programs', 'activities', 'initiatives'
      ]
    },
    '5.4.3': {
      ar: [
        'الأدوات التقنية', 'الأدوات الرقمية', 'التقنيات',
        'الأنظمة', 'البرمجيات', 'التطبيقات', 'المنصات',
        'الدعم التقني', 'المساعدة التقنية', 'التدريب التقني',
        'الاستخدام', 'الاعتماد', 'التطبيق'
      ],
      en: [
        'technical tools', 'digital tools', 'technologies',
        'systems', 'software', 'applications', 'platforms',
        'technical support', 'technical assistance', 'technical training',
        'usage', 'adoption', 'utilization'
      ]
    },
    '5.4.4': {
      ar: [
        'استراتيجية', 'استراتيجيات', 'خطة', 'خطط',
        'التطوير المستمر', 'التحسين المستمر', 'التطوير',
        'المتابعة', 'الرصد', 'المراقبة',
        'قياس الأثر', 'تقييم الأثر', 'النتائج'
      ],
      en: [
        'strategy', 'strategies', 'plan', 'plans',
        'continuous development', 'continuous improvement', 'development',
        'monitoring', 'tracking', 'oversight',
        'impact measurement', 'impact assessment', 'results'
      ]
    }
  };

  protected async onInitialize(): Promise<void> {
    console.log(`Evidence Extractor Agent ${this.config.id} initialized`);
  }

  protected async onExecute(input: EvidenceExtractorInput): Promise<Evidence[]> {
    const { documentMetadata, criteriaId, language } = input;
    const text = documentMetadata.extractedText;

    try {
      const keywords = this.criteriaKeywords[criteriaId]?.[language] || [];
      if (keywords.length === 0) {
        console.warn(`No keywords found for criteria ${criteriaId} in language ${language}`);
        return [];
      }

      const evidence: Evidence[] = [];
      const sentences = this.splitIntoSentences(text, language);

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const relevance = this.calculateRelevance(sentence, keywords, language);

        if (relevance > 0.3) { // Threshold for relevance
          // Get context (surrounding sentences)
          const contextStart = Math.max(0, i - 1);
          const contextEnd = Math.min(sentences.length - 1, i + 1);
          const context = sentences.slice(contextStart, contextEnd + 1).join(' ');

          evidence.push({
            text: sentence.trim(),
            relevance,
            criteriaId,
            context: context.trim(),
            position: i
          });
        }
      }

      // Sort by relevance and limit results
      evidence.sort((a, b) => b.relevance - a.relevance);
      const limitedEvidence = evidence.slice(0, 10); // Top 10 pieces of evidence

      console.log(`Extracted ${limitedEvidence.length} pieces of evidence for criteria ${criteriaId}`);
      return limitedEvidence;

    } catch (error) {
      console.error(`Evidence extraction failed for criteria ${criteriaId}:`, error);
      throw new Error(`Failed to extract evidence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private splitIntoSentences(text: string, language: 'ar' | 'en'): string[] {
    // Simple sentence splitting that works for both Arabic and English
    const sentenceEnders = language === 'ar' 
      ? /[.!?؟۔]/g 
      : /[.!?]/g;

    return text
      .split(sentenceEnders)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short sentences
  }

  private calculateRelevance(sentence: string, keywords: string[], language: 'ar' | 'en'): number {
    const lowerSentence = sentence.toLowerCase();
    let matchCount = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      
      // Exact match
      if (lowerSentence.includes(lowerKeyword)) {
        matchCount++;
        totalWeight += 1.0;
      }
      // Partial match for compound words
      else if (lowerKeyword.includes(' ') && 
               lowerKeyword.split(' ').some(part => lowerSentence.includes(part))) {
        matchCount++;
        totalWeight += 0.7;
      }
      // Fuzzy match for Arabic text (handle different forms)
      else if (language === 'ar' && this.fuzzyMatch(lowerSentence, lowerKeyword)) {
        matchCount++;
        totalWeight += 0.5;
      }
    }

    // Calculate relevance score
    const keywordDensity = totalWeight / keywords.length;
    const sentenceLength = sentence.split(/\s+/).length;
    const lengthBonus = Math.min(1.0, sentenceLength / 20); // Bonus for longer sentences

    return Math.min(1.0, keywordDensity * 0.8 + lengthBonus * 0.2);
  }

  private fuzzyMatch(text: string, keyword: string): boolean {
    // Simple fuzzy matching for Arabic text
    if (keyword.length < 3) return false;
    
    const keywordRoot = keyword.substring(0, Math.max(3, keyword.length - 2));
    return text.includes(keywordRoot);
  }
}
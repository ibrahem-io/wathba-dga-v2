import { AgentManager } from '../agents/AgentManager';
import { DocumentMetadata, Evidence, ComplianceScore } from '../agents/types';

export class LangChainAuditService {
  private agentManager: AgentManager;
  private isInitialized: boolean = false;

  constructor() {
    this.agentManager = new AgentManager();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Agent manager initializes agents automatically
      this.isInitialized = true;
      console.log('LangChain Audit Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LangChain Audit Service:', error);
      throw error;
    }
  }

  public async analyzeDocument(file: File, language: 'ar' | 'en'): Promise<{
    metadata: DocumentMetadata;
    complianceScores: ComplianceScore[];
  }> {
    await this.initialize();

    try {
      // Step 1: Parse document
      console.log('Starting document parsing...');
      const parseResult = await this.agentManager.executeTask('document_parser', { file }, 1);
      
      if (!parseResult.success) {
        throw new Error(`Document parsing failed: ${parseResult.error}`);
      }

      const metadata: DocumentMetadata = parseResult.data;
      console.log('Document parsing completed successfully');

      // Step 2: Extract evidence for each criteria
      const criteriaIds = ['5.4.1', '5.4.2', '5.4.3', '5.4.4'];
      const evidencePromises = criteriaIds.map(criteriaId =>
        this.agentManager.executeTask('evidence_extractor', {
          documentMetadata: metadata,
          criteriaId,
          language
        }, 2)
      );

      console.log('Starting evidence extraction for all criteria...');
      const evidenceResults = await Promise.all(evidencePromises);
      
      // Step 3: Score compliance for each criteria
      const scoringPromises = criteriaIds.map((criteriaId, index) => {
        const evidenceResult = evidenceResults[index];
        const evidence: Evidence[] = evidenceResult.success ? evidenceResult.data : [];
        
        return this.agentManager.executeTask('compliance_scorer', {
          documentMetadata: metadata,
          evidence,
          criteriaId,
          language
        }, 3);
      });

      console.log('Starting compliance scoring for all criteria...');
      const scoringResults = await Promise.all(scoringPromises);

      // Compile results
      const complianceScores: ComplianceScore[] = scoringResults.map((result, index) => {
        if (result.success) {
          return result.data;
        } else {
          // Fallback score for failed scoring
          return {
            criteriaId: criteriaIds[index],
            score: 0,
            status: 'fail' as const,
            confidence: 50,
            evidence: [],
            findings: `Scoring failed: ${result.error}`,
            recommendations: ['Review document content', 'Ensure proper formatting', 'Add more detailed information']
          };
        }
      });

      console.log('Document analysis completed successfully');
      return {
        metadata,
        complianceScores
      };

    } catch (error) {
      console.error('Document analysis failed:', error);
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async analyzeCriteria(
    file: File, 
    criteriaId: string, 
    language: 'ar' | 'en'
  ): Promise<ComplianceScore> {
    await this.initialize();

    try {
      // Parse document
      const parseResult = await this.agentManager.executeTask('document_parser', { file }, 1);
      if (!parseResult.success) {
        throw new Error(`Document parsing failed: ${parseResult.error}`);
      }

      const metadata: DocumentMetadata = parseResult.data;

      // Extract evidence
      const evidenceResult = await this.agentManager.executeTask('evidence_extractor', {
        documentMetadata: metadata,
        criteriaId,
        language
      }, 2);

      const evidence: Evidence[] = evidenceResult.success ? evidenceResult.data : [];

      // Score compliance
      const scoringResult = await this.agentManager.executeTask('compliance_scorer', {
        documentMetadata: metadata,
        evidence,
        criteriaId,
        language
      }, 3);

      if (!scoringResult.success) {
        throw new Error(`Compliance scoring failed: ${scoringResult.error}`);
      }

      return scoringResult.data;

    } catch (error) {
      console.error(`Criteria analysis failed for ${criteriaId}:`, error);
      throw error;
    }
  }

  public getSystemStatus(): {
    agentStates: any;
    queueLength: number;
    activeAgents: number;
  } {
    return {
      agentStates: Object.fromEntries(this.agentManager.getAgentStates()),
      queueLength: this.agentManager.getQueueLength(),
      activeAgents: this.agentManager.getActiveAgentCount()
    };
  }

  public async shutdown(): Promise<void> {
    await this.agentManager.shutdown();
    this.isInitialized = false;
    console.log('LangChain Audit Service shut down');
  }
}

// Singleton instance
export const langchainService = new LangChainAuditService();
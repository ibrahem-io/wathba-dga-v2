import { AgentConfig, AgentResult, AgentTask, AgentState, AgentType } from './types';
import { DocumentParserAgent } from './DocumentParserAgent';
import { EvidenceExtractorAgent } from './EvidenceExtractorAgent';
import { ComplianceScorerAgent } from './ComplianceScorerAgent';
import { BaseAgent } from './BaseAgent';

export class AgentManager {
  private agents: Map<string, BaseAgent> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  private taskQueue: AgentTask[] = [];
  private maxConcurrentAgents: number = 5;
  private activeAgents: Set<string> = new Set();
  private isProcessing: boolean = false;

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents(): void {
    const configs: AgentConfig[] = [
      {
        id: 'doc-parser-1',
        name: 'Document Parser Agent 1',
        type: 'document_parser',
        maxRetries: 3,
        timeout: 30000,
        priority: 1
      },
      {
        id: 'doc-parser-2',
        name: 'Document Parser Agent 2',
        type: 'document_parser',
        maxRetries: 3,
        timeout: 30000,
        priority: 1
      },
      {
        id: 'evidence-extractor-1',
        name: 'Evidence Extractor Agent 1',
        type: 'evidence_extractor',
        maxRetries: 2,
        timeout: 45000,
        priority: 2
      },
      {
        id: 'evidence-extractor-2',
        name: 'Evidence Extractor Agent 2',
        type: 'evidence_extractor',
        maxRetries: 2,
        timeout: 45000,
        priority: 2
      },
      {
        id: 'compliance-scorer-1',
        name: 'Compliance Scorer Agent 1',
        type: 'compliance_scorer',
        maxRetries: 2,
        timeout: 60000,
        priority: 3
      }
    ];

    configs.forEach(config => {
      const agent = this.createAgent(config);
      this.agents.set(config.id, agent);
      this.agentStates.set(config.id, {
        id: config.id,
        status: 'idle',
        lastActivity: new Date(),
        errorCount: 0
      });
    });
  }

  private createAgent(config: AgentConfig): BaseAgent {
    switch (config.type) {
      case 'document_parser':
        return new DocumentParserAgent(config);
      case 'evidence_extractor':
        return new EvidenceExtractorAgent(config);
      case 'compliance_scorer':
        return new ComplianceScorerAgent(config);
      default:
        throw new Error(`Unknown agent type: ${config.type}`);
    }
  }

  public async executeTask(type: AgentType, input: any, priority: number = 1): Promise<AgentResult> {
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      input,
      priority,
      retries: 0,
      createdAt: new Date()
    };

    return new Promise((resolve, reject) => {
      this.addTaskToQueue(task, resolve, reject);
      this.processQueue();
    });
  }

  private addTaskToQueue(
    task: AgentTask, 
    resolve: (result: AgentResult) => void, 
    reject: (error: Error) => void
  ): void {
    const taskWithCallbacks = {
      ...task,
      resolve,
      reject
    } as any;

    // Insert task in priority order
    const insertIndex = this.taskQueue.findIndex(t => t.priority > task.priority);
    if (insertIndex === -1) {
      this.taskQueue.push(taskWithCallbacks);
    } else {
      this.taskQueue.splice(insertIndex, 0, taskWithCallbacks);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.taskQueue.length > 0 && this.activeAgents.size < this.maxConcurrentAgents) {
        const task = this.taskQueue.shift();
        if (!task) break;

        const availableAgent = this.findAvailableAgent(task.type);
        if (availableAgent) {
          this.executeTaskWithAgent(availableAgent, task as any);
        } else {
          // Put task back at the front of the queue
          this.taskQueue.unshift(task);
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    // Schedule next processing cycle if there are pending tasks
    if (this.taskQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private findAvailableAgent(type: AgentType): BaseAgent | null {
    for (const [agentId, agent] of this.agents.entries()) {
      const state = this.agentStates.get(agentId);
      if (state?.status === 'idle' && agent.getConfig().type === type) {
        return agent;
      }
    }
    return null;
  }

  private async executeTaskWithAgent(agent: BaseAgent, task: any): Promise<void> {
    const agentId = agent.getConfig().id;
    const state = this.agentStates.get(agentId);
    
    if (!state) return;

    try {
      // Update agent state
      state.status = 'busy';
      state.currentTask = task;
      state.lastActivity = new Date();
      this.activeAgents.add(agentId);

      task.startedAt = new Date();

      // Execute task with timeout
      const result = await Promise.race([
        agent.execute(task.input),
        this.createTimeoutPromise(agent.getConfig().timeout)
      ]);

      task.completedAt = new Date();
      
      // Update state
      state.status = 'idle';
      state.currentTask = undefined;
      state.errorCount = 0;
      this.activeAgents.delete(agentId);

      // Resolve the task
      task.resolve(result);

    } catch (error) {
      console.error(`Agent ${agentId} failed:`, error);
      
      // Update error state
      state.errorCount++;
      state.status = state.errorCount >= agent.getConfig().maxRetries ? 'error' : 'idle';
      state.currentTask = undefined;
      this.activeAgents.delete(agentId);

      // Retry logic
      if (task.retries < agent.getConfig().maxRetries) {
        task.retries++;
        this.addTaskToQueue(task, task.resolve, task.reject);
        this.processQueue();
      } else {
        task.reject(new Error(`Agent execution failed after ${task.retries} retries: ${error}`));
      }
    }
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Agent execution timeout')), timeout);
    });
  }

  public getAgentStates(): Map<string, AgentState> {
    return new Map(this.agentStates);
  }

  public getQueueLength(): number {
    return this.taskQueue.length;
  }

  public getActiveAgentCount(): number {
    return this.activeAgents.size;
  }

  public async shutdown(): Promise<void> {
    // Stop processing new tasks
    this.isProcessing = true;
    
    // Wait for active agents to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeAgents.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear remaining tasks
    this.taskQueue.forEach((task: any) => {
      task.reject(new Error('Agent manager shutdown'));
    });
    this.taskQueue = [];

    // Reset all agent states
    this.agentStates.forEach(state => {
      state.status = 'stopped';
      state.currentTask = undefined;
    });

    this.activeAgents.clear();
  }
}
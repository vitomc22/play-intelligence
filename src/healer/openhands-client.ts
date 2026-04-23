/**
 * Cliente para comunicar com OpenHands
 * OpenHands roda em http://localhost:3000 como agente de IA para engenharia de software
 */

export interface OpenHandsTask {
  id: string;
  title: string;
  description: string;
  workspaceDir: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface OpenHandsResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Cliente para o OpenHands
 * Comunica via API REST ou webhooks para executar tarefas
 */
export class OpenHandsClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:3000', timeout: number = 600000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout; // 10 min timeout padrão
  }

  /**
   * Envia uma tarefa ao OpenHands para executar
   * O agente vai analisar os testes e corrigir automaticamente
   */
  async submitTask(task: Partial<OpenHandsTask>): Promise<OpenHandsResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`🤖 Enviando tarefa ao OpenHands: ${task.title}`);

      const response = await fetch(`${this.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...task,
          id: task.id || `task-${Date.now()}`,
          status: 'pending',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `OpenHands API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as OpenHandsResponse;
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Timeout ao conectar ao OpenHands após ${this.timeout}ms`);
      }

      if (error.cause?.code === 'ECONNREFUSED') {
        throw new Error(
          `OpenHands não está rodando em ${this.baseUrl}. ` +
          `Inicie com: bash setup-ollama.sh`
        );
      }

      throw error;
    }
  }

  /**
   * Executa comando direto no sandbox do OpenHands
   * Útil para rodar npm test, git commands, etc
   */
  async executeCommand(command: string, workspaceDir: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`⚙️ Executando no OpenHands: ${command}`);

      const response = await fetch(`${this.baseUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
          workspaceDir,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Comando falhou: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.output || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Polling para checar status de uma tarefa
   */
  async waitForTask(taskId: string, maxWait: number = this.timeout): Promise<OpenHandsTask> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 segundos

    while (Date.now() - startTime < maxWait) {
      try {
        const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const task = (await response.json()) as OpenHandsTask;

        if (task.status === 'completed' || task.status === 'failed') {
          return task;
        }

        console.log(`⏳ Aguardando conclusão da tarefa... Status: ${task.status}`);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error: any) {
        console.error(`Erro ao verificar status:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(
      `Timeout aguardando tarefa ${taskId} por ${maxWait}ms`
    );
  }
}

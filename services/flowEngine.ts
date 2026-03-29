import { FlowNode, FlowEdge, NodeType, NodeStatus, LogEntry, ExecutionContext, GeneratedFile } from '../types';
import { keyManager } from './keyManager';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createLog = (nodeId: string, label: string, level: LogEntry['level'], message: string): LogEntry => ({
  id: Math.random().toString(36).substr(2, 9),
  timestamp: new Date().toISOString(),
  nodeId,
  nodeLabel: label,
  level,
  message
});

export class FlowEngine {
  private nodes: FlowNode[];
  private edges: FlowEdge[];
  private setNodes: (nodes: FlowNode[] | ((nodes: FlowNode[]) => FlowNode[])) => void;
  private addLog: (log: LogEntry) => void;
  private onFileGenerated?: (file: GeneratedFile) => void;
  public context: ExecutionContext = {};

  constructor(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    setNodes: any, 
    addLog: any,
    onFileGenerated?: (file: GeneratedFile) => void
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.setNodes = setNodes;
    this.addLog = addLog;
    this.onFileGenerated = onFileGenerated;
  }

  private updateNodeStatus(nodeId: string, status: NodeStatus) {
    this.setNodes((nds: FlowNode[]) => 
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)
    );
  }

  private async fetchWithRetry(url: string, options: any, nodeId: string, label: string): Promise<any> {
    let attempts = 0;
    const totalKeys = JSON.parse(keyManager.getStatus()).total;
    // Se tivermos chaves no pool, tentamos rodar o pool inteiro. Se não, tentamos 3 vezes padrão.
    const maxRetries = totalKeys > 0 ? totalKeys + 1 : 3;

    while (attempts < maxRetries) {
        const activeKey = keyManager.getActiveKey();
        let finalUrl = url;

        // Injeta a chave na URL se for Google API
        if (url.includes('googleapis.com') && activeKey) {
            // Remove chave antiga se existir para não duplicar
            const urlObj = new URL(url);
            urlObj.searchParams.set('key', activeKey);
            finalUrl = urlObj.toString();
        }

        try {
            const response = await fetch(finalUrl, options);
            const status = response.status;

            if (response.ok) {
                return await response.json();
            }

            // LÊ O ERRO UMA ÚNICA VEZ PARA EVITAR "STREAM ALREADY READ"
            const errorText = await response.text();

            // TRATAMENTO DE ERROS DE CHAVE (403: Referrer/Forbidden/Leaked, 400: Invalid, 429: Quota)
            if (status === 403 || status === 400 || status === 429) {
                const isLeaked = errorText.toLowerCase().includes('leaked');
                let logMsg = `🔄 Chave #${keyManager.getCurrentIndex() + 1} falhou (${status}). Rotacionando...`;
                
                if (isLeaked) {
                    logMsg = `🚫 Chave #${keyManager.getCurrentIndex() + 1} identificada como VAZADA. Removendo do pool...`;
                }

                console.warn(`[FlowEngine] ${logMsg}`, errorText.substring(0, 100));
                
                // Tenta rotacionar a chave
                if (keyManager.markCurrentKeyAsFailed()) {
                    this.addLog(createLog(nodeId, label, 'WARN', logMsg));
                    attempts++;
                    await wait(200);
                    continue; // Tenta com a próxima chave
                }
            }

            // Se não for erro de chave ou se acabaram as chaves, lança o erro final
            throw new Error(`Erro API (${status}): ${errorText.substring(0, 300)}`);

        } catch (err: any) {
            // Se for erro de rede (fetch failed) ou se as tentativas acabaram
            if (attempts >= maxRetries - 1) throw err;
            attempts++;
            await wait(500);
        }
    }
  }

  private async executeNode(node: FlowNode): Promise<boolean> {
    let { type, config, label } = node.data;
    if (!type && node.type) type = node.type as NodeType;
    if (!label) label = type || 'Node';

    this.updateNodeStatus(node.id, NodeStatus.RUNNING);

    try {
        await wait(100);

        switch (type) {
          case NodeType.START:
              this.addLog(createLog(node.id, label, 'SUCCESS', `🟢 Execução iniciada.`));
              break;

          case NodeType.HTTP_REQUEST:
            let url = config?.url;
            if (!url) throw new Error("URL não definida no nó.");

            const method = (config?.method || 'GET').toUpperCase();
            const body = config?.body ? (typeof config.body === 'string' ? JSON.parse(config.body) : config.body) : undefined;
            
            const responseData = await this.fetchWithRetry(url, { 
                method, 
                headers: { 'Content-Type': 'application/json' }, 
                body: method !== 'GET' ? JSON.stringify(body) : undefined 
            }, node.id, label);
            
            this.context[node.id] = responseData;
            this.context['input'] = responseData; 
            this.addLog(createLog(node.id, label, 'SUCCESS', `📦 Requisição concluída.`));
            break;

          case NodeType.GEMINI:
            let prompt = config?.prompt || 'Olá, como posso ajudar?';
            const inputData = this.context['input'];
            
            // Substitui {{input}} pelo conteúdo do node anterior
            if (prompt.includes('{{input}}')) {
                const replacement = typeof inputData === 'object' ? JSON.stringify(inputData) : String(inputData || '');
                prompt = prompt.replace('{{input}}', replacement);
            }

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`;
            
            const geminiBody = {
              contents: [{
                parts: [{ text: prompt }]
              }]
            };

            const geminiResponse = await this.fetchWithRetry(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiBody)
            }, node.id, label);

            const aiText = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";
            this.context[node.id] = aiText;
            this.context['input'] = aiText;
            this.addLog(createLog(node.id, label, 'SUCCESS', `🤖 IA respondeu: ${aiText.substring(0, 50)}...`));
            break;

          case NodeType.DELAY:
            const ms = config?.ms || 1000;
            this.addLog(createLog(node.id, label, 'INFO', `⏳ Aguardando ${ms}ms...`));
            await wait(ms);
            break;

          case NodeType.LOGGER:
            const logMsg = config?.message || 'Log manual executado.';
            this.addLog(createLog(node.id, label, 'INFO', `📝 ${logMsg}`));
            break;

          case NodeType.DISCORD:
            const discordWebhook = config?.webhookUrl;
            if (!discordWebhook) throw new Error("Webhook do Discord não configurado.");
            const discordContent = config?.content || 'Mensagem do Flow Architect AI';
            
            await fetch(discordWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: discordContent })
            });
            this.addLog(createLog(node.id, label, 'SUCCESS', `💬 Mensagem enviada ao Discord.`));
            break;

          case NodeType.TELEGRAM:
            const botToken = config?.botToken;
            const chatId = config?.chatId;
            if (!botToken || !chatId) throw new Error("Token ou Chat ID do Telegram não configurado.");
            const telegramText = config?.text || 'Mensagem do Flow Architect AI';
            
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: telegramText })
            });
            this.addLog(createLog(node.id, label, 'SUCCESS', `📱 Mensagem enviada ao Telegram.`));
            break;

          case NodeType.WEBHOOK:
            this.addLog(createLog(node.id, label, 'INFO', `🔗 Webhook recebido.`));
            // Injeta os dados do webhook no input para o próximo nó
            if (this.context['webhook_data']) {
                this.context['input'] = this.context['webhook_data'];
                this.addLog(createLog(node.id, label, 'SUCCESS', `📥 Dados do webhook injetados no fluxo.`));
            }
            break;

          case NodeType.IF_CONDITION:
            const condition = config?.condition || 'true';
            const input = this.context['input'] || {};
            // Cria um sandbox simples para a condição
            const check = new Function('input', `try { return ${condition}; } catch(e) { return false; }`);
            const result = !!check(input);
            this.addLog(createLog(node.id, label, result ? 'SUCCESS' : 'WARN', `⚖️ Condição resultou em: ${result.toString().toUpperCase()}`));
            this.context[node.id] = result;
            break;

          case NodeType.FILE_SAVE:
            const fileName = config?.fileName || `output-${Date.now()}.txt`;
            let content = this.context['input'];
            
            // Se vier do Gemini, extrai o texto principal
            if (content?.candidates?.[0]?.content?.parts?.[0]?.text) {
                content = content.candidates[0].content.parts[0].text;
            }

            if (this.onFileGenerated && content) {
              this.onFileGenerated({
                  id: Math.random().toString(36).substring(2),
                  name: fileName,
                  content: typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content),
                  extension: config?.fileFormat || 'txt',
                  timestamp: Date.now(),
                  nodeId: node.id
              });
              this.addLog(createLog(node.id, label, 'SUCCESS', `💾 Arquivo gerado: ${fileName}`));
            }
            break;
        }

        this.updateNodeStatus(node.id, NodeStatus.SUCCESS);
        return true;

    } catch (error: any) {
        this.updateNodeStatus(node.id, NodeStatus.ERROR);
        this.addLog(createLog(node.id, label, 'ERROR', `❌ Falha: ${error.message}`));
        return false;
    }
  }

  public async run() {
    this.context = {}; 
    const startNodes = this.nodes.filter(n => n.data.type === NodeType.START || n.data.type === NodeType.WEBHOOK);
    const queue: FlowNode[] = startNodes.length > 0 ? startNodes : [this.nodes[0]];

    while (queue.length > 0) {
      const currentNode = queue.shift();
      if (!currentNode) continue;

      const success = await this.executeNode(currentNode);
      if (success) {
        const nextNodes = this.edges
          .filter(e => e.source === currentNode.id)
          .map(e => this.nodes.find(n => n.id === e.target))
          .filter(Boolean) as FlowNode[];
        queue.push(...nextNodes);
      }
    }
    this.addLog(createLog('system', 'Engine', 'INFO', `🏁 Fluxo finalizado.`));
  }
}
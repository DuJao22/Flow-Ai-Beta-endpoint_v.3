import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { FlowSchema, FlowContext } from '../types';
import { keyManager } from './keyManager';

/**
 * Valida uma chave de API fazendo uma requisição mínima
 */
export const validateGeminiKey = async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Tenta gerar 1 token apenas para validar a conexão/autenticação
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { role: 'user', parts: [{ text: 'Ping' }] },
      config: { 
        maxOutputTokens: 1,
      }
    });

    return { valid: true };
  } catch (error: any) {
    console.error("Key Validation Error:", error);
    let msg = "Erro desconhecido";
    
    if (error.status === 403 || error.message?.includes('403')) msg = "Chave Inválida ou Restrita (403)";
    else if (error.status === 400 || error.message?.includes('API_KEY_INVALID')) msg = "Chave Inexistente/Malformada";
    else if (error.message?.includes('quota')) msg = "Quota Excedida (Sem créditos)";
    else msg = error.message?.substring(0, 50) + "...";

    return { valid: false, error: msg };
  }
};

export const generateFlowFromPrompt = async (userPrompt: string, context?: FlowContext): Promise<{ text: string, flowData?: FlowSchema }> => {
  const statusInfo = JSON.parse(keyManager.getStatus());
  const maxRetries = Math.max(statusInfo.total * 2, 3); 
  
  let lastError = "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const activeKey = keyManager.getActiveKey();
    
    if (!activeKey) {
        return { 
          text: "❌ **Erro Crítico**: Nenhuma chave de API funcional encontrada no pool. Por favor, adicione uma chave válida nas configurações ou no arquivo `api_keys_list.ts`.", 
          flowData: undefined 
        };
    }

    try {
      // Criamos uma nova instância a cada tentativa para garantir o uso da chave atualizada
      const ai = new GoogleGenAI({ apiKey: activeKey });
      
      let finalPromptParts: any[] = [{ text: SYSTEM_PROMPT }];

      if (context) {
          const recentLogs = context.logs.slice(-5).map(l => `[${l.level}] ${l.nodeLabel}: ${l.message}`).join('\n');
          const contextString = `\nCONTEXTO ATUAL:\nNodes: ${context.currentNodes.length}\nLogs Recentes:\n${recentLogs}`;
          finalPromptParts.push({ text: contextString });
      }

      finalPromptParts.push({ text: `SOLICITAÇÃO DO USUÁRIO: ${userPrompt}` });

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: finalPromptParts }],
          config: { 
              temperature: 0.2,
              responseMimeType: 'application/json'
          }
      });

      const text = response.text || "";
      let flowData: FlowSchema | undefined;

      try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : text;
          const parsed = JSON.parse(jsonString);
          if (parsed.nodes) flowData = parsed as FlowSchema;
      } catch (e) {
          console.warn("[IA] Falha ao parsear JSON, enviando texto puro.");
      }

      return { 
        text: flowData ? `✨ Fluxo gerado com sucesso (Chave #${keyManager.getCurrentIndex() + 1})` : text, 
        flowData 
      };

    } catch (error: any) {
      const errorMsg = error.message || "";
      const isForbidden = error.status === 403 || errorMsg.includes('403') || errorMsg.includes('API_KEY_INVALID');
      const isQuota = error.status === 429 || errorMsg.includes('429') || errorMsg.includes('quota');
      const isLeaked = errorMsg.toLowerCase().includes('leaked');

      console.error(`[IA Attempt ${attempt + 1}] Falha na Chave #${keyManager.getCurrentIndex() + 1}: ${errorMsg}`);
      lastError = errorMsg;

      if (isForbidden || isQuota || isLeaked) {
          // Marca como falha e tenta a próxima chave imediatamente
          keyManager.markCurrentKeyAsFailed();
          continue; 
      }

      // Se for outro erro, retorna para o usuário
      return { 
          text: `❌ **Erro Gemini**: ${errorMsg}`, 
          flowData: undefined 
      };
    }
  }
  
  // Mensagem final mais descritiva
  let userHelp = "";
  if (lastError.toLowerCase().includes('leaked')) {
      userHelp = "\n\n🚨 **ALERTA DE SEGURANÇA:**\nSua chave de API foi detectada como VAZADA publicamente e bloqueada pelo Google. Você DEVE gerar uma nova chave no Google AI Studio imediatamente.";
  } else if (lastError.includes('403')) {
      userHelp = "\n\n💡 **Dica para Deploy (Vercel/Netlify):**\nO erro 403 geralmente significa que suas chaves no Google Cloud têm restrição de domínio (Referrer). Adicione o domínio do seu site hospedado nas configurações da chave ou remova as restrições de site.";
  }

  return { 
    text: `❌ **Falha Total no Pool de Chaves**\n\nTodas as ${statusInfo.total} chaves retornaram erro. A última falha foi: ${lastError}${userHelp}`, 
    flowData: undefined 
  };
};
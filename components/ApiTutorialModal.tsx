import React, { useState } from 'react';

interface ApiTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiTutorialModal: React.FC<ApiTutorialModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const endpointUrl = `${window.location.origin}/api/execute-flow`;

  const handleCopy = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const payloadExample = `{
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "data": { "type": "start", "label": "Início" }
    },
    {
      "id": "http-1",
      "type": "httpRequest",
      "data": { 
        "type": "httpRequest", 
        "label": "Minha API",
        "config": { "url": "https://api.exemplo.com/dados", "method": "GET" }
      }
    }
  ],
  "edges": [
    {
      "id": "e-start-http",
      "source": "start-1",
      "target": "http-1"
    }
  ]
}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-none">API / Webhook</h2>
              <p className="text-xs text-gray-400 mt-1">Execute fluxos remotamente via requisição HTTP</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Endpoint Section */}
          <section>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Endpoint</h3>
            <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-lg p-2">
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded">POST</span>
              <code className="text-sm text-gray-300 flex-1 overflow-x-auto whitespace-nowrap px-2">
                {endpointUrl}
              </code>
              <button 
                onClick={handleCopy}
                className="shrink-0 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copiar
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Envie uma requisição POST para este endpoint para executar o fluxo de forma invisível no servidor.
            </p>
          </section>

          {/* Payload Section */}
          <section>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Corpo da Requisição (JSON)</h3>
            <p className="text-xs text-gray-400 mb-3">
              O corpo da requisição deve conter a estrutura do fluxo (você pode exportar o JSON do fluxo atual clicando em "Exportar JSON" no menu).
            </p>
            <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center">
                <span className="text-xs text-gray-500 font-mono">Content-Type: application/json</span>
              </div>
              <pre className="p-4 overflow-x-auto text-xs text-emerald-400 font-mono leading-relaxed">
                {payloadExample}
              </pre>
            </div>
          </section>

          {/* Response Section */}
          <section>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Resposta de Sucesso</h3>
            <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
              <pre className="p-4 overflow-x-auto text-xs text-blue-400 font-mono leading-relaxed">
{`{
  "success": true,
  "message": "Fluxo executado com sucesso.",
  "logs": [
    { "level": "SUCCESS", "message": "🟢 Execução iniciada.", "nodeLabel": "Início" }
  ],
  "files": [],
  "finalNodesState": [...]
}`}
              </pre>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default ApiTutorialModal;

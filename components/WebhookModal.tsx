import React, { useState } from 'react';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl: string;
}

const WebhookModal: React.FC<WebhookModalProps> = ({ isOpen, onClose, webhookUrl }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
        
        <div className="p-6 text-center border-b border-gray-800 bg-indigo-950/20">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 shadow-lg">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Fluxo Publicado!</h2>
          <p className="text-sm text-indigo-300/70 mt-1 font-medium">Seu fluxo agora pode ser acionado via Webhook.</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">URL do Webhook</label>
            <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl p-3 group hover:border-indigo-500/50 transition-colors">
              <code className="text-xs text-indigo-300 font-mono flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
                {webhookUrl}
              </code>
              <button 
                onClick={handleCopy}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 active:scale-95'}`}
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Como usar
            </h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Envie uma requisição <span className="text-indigo-400 font-bold">POST</span> ou <span className="text-indigo-400 font-bold">GET</span> para esta URL. 
              Os dados enviados serão injetados no nó <span className="text-emerald-400 font-bold">Webhook</span> do seu fluxo.
            </p>
          </div>
        </div>

        <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebhookModal;

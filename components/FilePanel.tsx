import React from 'react';
import { GeneratedFile } from '../types';

interface FilePanelProps {
  files: GeneratedFile[];
  isOpen?: boolean;
  onDeleteFile?: (id: string) => void;
  projectName?: string;
}

const FilePanel: React.FC<FilePanelProps> = ({ files, isOpen = true, onDeleteFile, projectName }) => {
  
  const downloadFile = (file: GeneratedFile) => {
    const byteOrderMark = '\uFEFF';
    let mimeType = 'text/plain;charset=utf-8';
    if (file.extension === 'json') mimeType = 'application/json;charset=utf-8';
    if (file.extension === 'csv') mimeType = 'text/csv;charset=utf-8';

    const blob = new Blob([byteOrderMark, file.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    files.forEach((file, index) => {
        setTimeout(() => downloadFile(file), index * 300);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="h-full bg-gray-950 flex flex-col font-mono text-xs w-full">
      {/* HEADER DO EXPLORER */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" /></svg>
              <span className="font-black uppercase tracking-widest text-gray-400 text-[10px]">
                  Explorer: <span className="text-white">{projectName || 'Arquivos Temporários'}</span>
              </span>
          </div>
          {files.length > 0 && (
              <button 
                onClick={downloadAll}
                className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-tighter flex items-center gap-1 bg-blue-900/20 px-2 py-1 rounded border border-blue-900/30 transition-all"
              >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Baixar Tudo
              </button>
          )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2 opacity-50">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="italic text-[10px] uppercase tracking-widest font-black">Nenhum arquivo gerado</span>
            <p className="text-[9px] max-w-[150px] text-center leading-relaxed">Use o nó "Salvar Arquivo" no seu fluxo para gerar saídas aqui.</p>
          </div>
        )}
        
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between bg-gray-900/40 border border-gray-800/50 p-3 rounded-xl hover:border-gray-600 hover:bg-gray-900/80 transition-all group">
             <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black uppercase text-[10px] border transition-colors ${
                    file.extension === 'json' ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900/30' :
                    file.extension === 'csv' ? 'bg-green-900/20 text-green-500 border-green-900/30' :
                    'bg-blue-900/20 text-blue-500 border-blue-900/30'
                }`}>
                    {file.extension}
                </div>
                <div className="flex flex-col">
                    <span className="text-gray-200 font-bold text-xs truncate max-w-[180px]">{file.name}</span>
                    <span className="text-[9px] text-gray-500 font-medium uppercase tracking-tighter">
                        {new Date(file.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {Math.round(file.content.length / 1024 * 100) / 100} KB
                    </span>
                </div>
             </div>
             
             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                    onClick={() => downloadFile(file)}
                    className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-all border border-gray-700"
                    title="Baixar Arquivo"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 </button>
                 {onDeleteFile && (
                     <button 
                        onClick={() => onDeleteFile(file.id)}
                        className="text-gray-500 hover:text-red-400 bg-gray-800 hover:bg-red-900/20 p-2 rounded-lg transition-all border border-gray-700 hover:border-red-900/30"
                        title="Excluir Arquivo"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     </button>
                 )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilePanel;

import React, { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel,
  MarkerType,
} from 'reactflow';
import type { Connection } from 'reactflow';
import CustomNode from './components/CustomNode';
import AIChat from './components/AIChat';
import LogPanel from './components/LogPanel';
import FilePanel from './components/FilePanel';
import SettingsModal from './components/SettingsModal';
import ProjectLibraryModal from './components/ProjectLibraryModal'; 
import FlowJsonModal from './components/FlowJsonModal'; 
import WebhookModal from './components/WebhookModal';
import NodeConfigPanel from './components/NodeConfigPanel';
import KeyStatusPanel from './components/KeyStatusPanel';
import ApiTutorialModal from './components/ApiTutorialModal';
import { INITIAL_NODES, INITIAL_EDGES, APP_NAME } from './constants';
import { FlowEngine } from './services/flowEngine';
import { storageService } from './services/storageService'; 
import { FlowSchema, LogEntry, NodeStatus, GeneratedFile, FlowNode, SavedProject, NodeType, FlowEdge, NodeData } from './types';

const nodeTypes = {
  custom: CustomNode,
  httpRequest: CustomNode,
  webhook: CustomNode,
  delay: CustomNode,
  ifCondition: CustomNode,
  logger: CustomNode,
  discord: CustomNode,
  telegram: CustomNode,
  gemini: CustomNode,
  fileSave: CustomNode,
  start: CustomNode
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { strokeWidth: 3, stroke: '#3b82f6' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
};

const AUTOSAVE_KEY = 'flow_architect_autosave_v2';

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(INITIAL_NODES as FlowNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const [currentProject, setCurrentProject] = useState<{id: string, name: string} | null>(null);

  // MOBILE STATE
  const [activeTab, setActiveTab] = useState<'flow' | 'chat' | 'terminal'>('flow');
  
  // DESKTOP STATE (Toggles)
  const [showDesktopChat, setShowDesktopChat] = useState(true);
  const [showDesktopLogs, setShowDesktopLogs] = useState(false);

  const [terminalSubTab, setTerminalSubTab] = useState<'logs' | 'files'>('logs');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); 
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false); 
  const [isApiTutorialOpen, setIsApiTutorialOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges || []);
          setFiles(parsed.files || []);
          if (parsed.currentProject) setCurrentProject(parsed.currentProject);
          if (parsed.webhookUrl) setWebhookUrl(parsed.webhookUrl);
        }
      } catch (e) {}
    }
    setIsLoaded(true);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ nodes, edges, files, currentProject, webhookUrl }));
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, files, isLoaded, currentProject, webhookUrl]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const handlePublish = async () => {
    console.log("handlePublish: Iniciando publicação...");
    let project = currentProject;
    
    try {
        if (!project) {
            console.log("handlePublish: Nenhum projeto selecionado, criando um padrão...");
            // Se não houver projeto, salva com um nome padrão sem interromper com prompt
            const defaultName = `Fluxo Automático ${new Date().toLocaleDateString()}`;
            const newProj = storageService.saveProject(defaultName, nodes, edges, files);
            project = { id: newProj.id, name: newProj.name };
            setCurrentProject(project);
            console.log("handlePublish: Projeto criado:", project.id);
        }
        
        setSaveStatus('saving');
        console.log("handlePublish: Enviando para o servidor...");
        
        const response = await fetch('/api/save-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: project.id,
                nodes,
                edges
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido no servidor' }));
            throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log("handlePublish: Resposta do servidor:", data);

        if (data.success) {
            const fullUrl = `${window.location.origin}${data.webhookUrl}`;
            setWebhookUrl(fullUrl);
            setSaveStatus('saved');
            console.log("handlePublish: Sucesso! Abrindo modal...");
            setIsWebhookModalOpen(true); // ABRE O MODAL AO PUBLICAR
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            throw new Error(data.error || "Falha ao salvar fluxo no servidor.");
        }
    } catch (e: any) {
        console.error("handlePublish: Erro ao publicar:", e);
        alert("Erro ao publicar: " + e.message);
        setSaveStatus('idle');
    } finally {
        setTimeout(() => {
            setSaveStatus(prev => prev === 'saving' ? 'idle' : prev);
        }, 500);
    }
  };

  const handleAddNode = (type: NodeType, label: string) => {
    const id = `${type}-${Date.now()}`;
    const newNode: FlowNode = {
      id,
      type: 'custom',
      position: { x: 50, y: 150 },
      data: { label, type, status: NodeStatus.IDLE, config: {} }
    };
    setNodes((nds) => nds.concat(newNode));
    setIsAddMenuOpen(false);
    setSelectedNodeId(id);
  };

  const handleRunFlow = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setLogs([]); 
    
    // Auto-open logs on execution
    if (window.innerWidth >= 768) {
        setShowDesktopLogs(true);
    } else {
        setActiveTab('terminal');
    }
    setTerminalSubTab('logs');
    setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, status: NodeStatus.IDLE } })));

    const engine = new FlowEngine(
      nodes, edges, setNodes, 
      (log: LogEntry) => setLogs(prev => [...prev, log]),
      (file: GeneratedFile) => setFiles(prev => [file, ...prev])
    );

    try {
        await engine.run();
    } catch (e: any) {
        console.error("Erro na execução do fluxo:", e);
        setLogs(prev => [...prev, {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            nodeId: 'system',
            nodeLabel: 'Engine',
            level: 'ERROR',
            message: `Erro crítico: ${e.message}`
        }]);
    } finally {
        setIsExecuting(false);
    }
  }, [nodes, edges, isExecuting, setNodes]);

  const handleSaveProject = () => {
    setSaveStatus('saving');
    
    if (currentProject) {
        storageService.updateProject(currentProject.id, nodes, edges, files);
        setTimeout(() => setSaveStatus('saved'), 500);
        setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
        const name = window.prompt("Nome do Projeto:", "Meu Fluxo Automático");
        if (name) {
            const newProj = storageService.saveProject(name, nodes, edges, files);
            setCurrentProject({ id: newProj.id, name: newProj.name });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            setSaveStatus('idle');
        }
    }
  };

  const handleLoadProject = (project: SavedProject) => {
    setNodes(project.nodes.map(n => ({ ...n, type: 'custom' })));
    setEdges(project.edges.map(e => ({ ...e, ...defaultEdgeOptions })));
    setFiles(project.files || []);
    setCurrentProject({ id: project.id, name: project.name });
    setActiveTab('flow');
  };

  const handleImportFlow = (flowData: FlowSchema) => {
      setNodes(flowData.nodes.map(n => ({ ...n, type: 'custom' })));
      setEdges(flowData.edges.map(e => ({ ...e, ...defaultEdgeOptions })));
      setActiveTab('flow');
  };

  const handleImportJson = (newNodes: FlowNode[], newEdges: FlowEdge[]) => {
      setNodes(newNodes.map(n => ({ ...n, type: 'custom' })));
      setEdges(newEdges.map(e => ({ ...e, ...defaultEdgeOptions })));
      setActiveTab('flow');
  };

  const handleDeleteFile = (id: string) => {
    if (window.confirm('Excluir este arquivo permanentemente?')) {
        setFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-[100dvh] w-screen overflow-hidden flex-col bg-gray-950 text-white">
        
        {/* HEADER */}
        <header className="min-h-[3.5rem] h-auto py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 md:px-4 shrink-0 z-[120] shadow-xl pt-[calc(env(safe-area-inset-top)+0.5rem)] pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-sm shadow-lg shadow-blue-900/20">F</div>
                <div className="flex flex-col">
                    <h1 className="font-black text-[11px] md:text-xs tracking-tighter uppercase leading-none text-white flex items-center gap-1">
                      {APP_NAME} 
                      <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 tracking-widest">- BETA</span>
                    </h1>
                    <span className="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-[100px]">{currentProject?.name || 'Projeto Local'}</span>
                </div>
            </div>

            {/* DESKTOP TOGGLES */}
            <div className="hidden md:flex items-center gap-1 ml-4 border-l border-gray-700 pl-4 h-8">
                <button 
                    onClick={() => setShowDesktopLogs(!showDesktopLogs)}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${showDesktopLogs ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Alternar Painel de Logs"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    Logs
                </button>
                <button 
                    onClick={() => setShowDesktopChat(!showDesktopChat)}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${showDesktopChat ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Alternar Chat IA"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    IA Chat
                </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
             <div className="hidden md:block">
                 <KeyStatusPanel />
             </div>
             
             {/* BOTÃO JSON / CÓDIGO */}
             <button 
                onClick={() => setIsJsonModalOpen(true)}
                className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700 shadow-md active:scale-95 pointer-events-auto cursor-pointer relative z-[130]"
                title="Editor JSON / Importar"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
             </button>

             {/* BOTÃO API / WEBHOOK */}
             <button 
                onClick={() => webhookUrl ? setIsWebhookModalOpen(true) : setIsApiTutorialOpen(true)}
                className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-500 hover:text-emerald-400 transition-colors border border-emerald-800/50 shadow-md active:scale-95 pointer-events-auto cursor-pointer relative z-[130]"
                title="API / Webhook"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
             </button>

             {/* BOTÃO PUBLICAR (WEBHOOK) UPDATED */}
             <button 
                onClick={handlePublish}
                disabled={saveStatus === 'saving'}
                id="publish-button"
                className={`flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl transition-all border shadow-md active:scale-90 pointer-events-auto cursor-pointer relative z-[130] ${webhookUrl ? 'bg-indigo-900/40 border-indigo-700/50 text-indigo-400 hover:bg-indigo-800/60' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                title={webhookUrl ? "Atualizar Webhook no Servidor" : "Publicar como Webhook"}
             >
                {saveStatus === 'saving' ? (
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                )}
             </button>

             {/* BOTÃO SAVE */}
             <button 
                onClick={handleSaveProject}
                className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all border shadow-md active:scale-95 pointer-events-auto cursor-pointer relative z-[130] ${
                    saveStatus === 'saved' ? 'bg-green-600 text-white border-green-500' :
                    saveStatus === 'saving' ? 'bg-blue-800 text-blue-300 border-blue-700' :
                    'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border-gray-700'
                }`}
                title="Salvar Projeto"
             >
                {saveStatus === 'saved' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                )}
             </button>

             {/* BOTÃO SETTINGS */}
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700 shadow-md active:scale-95 pointer-events-auto cursor-pointer relative z-[130]"
                title="Configurações (API Keys)"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>

             {/* BOTÃO RUN */}
             <button 
                onClick={handleRunFlow} 
                disabled={isExecuting}
                className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all pointer-events-auto cursor-pointer relative z-[130] ${isExecuting ? 'bg-blue-900/50 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 active:scale-90'}`}
             >
                {isExecuting ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <svg className="w-5 h-5 fill-white" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 001.664l-3-2z"/></svg>}
             </button>
          </div>
        </header>

        {/* WEBHOOK URL BAR */}
        {webhookUrl && (
          <div className="bg-indigo-900/20 border-b border-indigo-500/20 px-4 py-1.5 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest shrink-0">Webhook Ativo:</span>
              <code className="text-[10px] font-mono text-indigo-200 truncate bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/30">
                {webhookUrl}
              </code>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                alert("URL copiada!");
              }}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-tighter shrink-0 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              Copiar
            </button>
          </div>
        )}

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 relative overflow-hidden bg-gray-950 flex flex-col md:flex-row">
          
          {/* ÁREA DE FLUXO & LOGS DESKTOP */}
          <div className={`flex-1 flex flex-col relative min-w-0 transition-opacity duration-200 ${activeTab === 'flow' || window.innerWidth >= 768 ? 'opacity-100' : 'hidden md:flex'}`}>
            
            {/* CANVAS */}
            <div className="flex-1 relative">
                <ReactFlow 
                    nodes={nodes} edges={edges} 
                    onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
                    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                    onPaneClick={() => setSelectedNodeId(null)} nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
                    fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
                >
                  <Background color="#1e293b" gap={25} size={1} />
                  
                  <Panel position="bottom-right" className="mb-20 md:mb-4">
                     <button 
                      onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} 
                      className="bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform border-4 border-gray-950"
                     >
                        {isAddMenuOpen ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                     </button>
                     
                     {isAddMenuOpen && (
                        <div className="absolute bottom-16 right-0 w-48 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-mobile-up z-50 p-1">
                            {[
                              {type: NodeType.START, label: 'Gatilho Manual', color: 'bg-green-500'},
                              {type: NodeType.HTTP_REQUEST, label: 'HTTP / API', color: 'bg-blue-500'},
                              {type: NodeType.GEMINI, label: 'IA Gemini', color: 'bg-purple-500'},
                              {type: NodeType.IF_CONDITION, label: 'Lógica IF', color: 'bg-yellow-500'},
                              {type: NodeType.DELAY, label: 'Aguardar (Delay)', color: 'bg-orange-500'},
                              {type: NodeType.FILE_SAVE, label: 'Salvar Arquivo', color: 'bg-indigo-500'},
                              {type: NodeType.DISCORD, label: 'Discord', color: 'bg-indigo-400'},
                              {type: NodeType.TELEGRAM, label: 'Telegram', color: 'bg-sky-500'},
                              {type: NodeType.LOGGER, label: 'Log / Console', color: 'bg-gray-500'},
                            ].map(item => (
                                <button key={item.type} onClick={() => handleAddNode(item.type, item.label)} className="w-full px-4 py-3 text-left text-xs hover:bg-gray-800 flex items-center gap-3 rounded-lg transition-colors font-bold text-gray-300">
                                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span> {item.label}
                                </button>
                            ))}
                        </div>
                     )}
                  </Panel>

                  <Controls position="top-left" className="!bg-gray-900 !border-gray-800 !fill-white hidden md:flex" />
                </ReactFlow>
            </div>

            {/* PAINEL INFERIOR DE LOGS (DESKTOP) */}
            {showDesktopLogs && (
                <div className="hidden md:flex flex-col h-[30%] min-h-[200px] border-t border-gray-800 bg-gray-950 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
                     <div className="flex bg-gray-900 p-1 border-b border-gray-800">
                        <button onClick={() => setTerminalSubTab('logs')} className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${terminalSubTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Logs</button>
                        <button onClick={() => setTerminalSubTab('files')} className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${terminalSubTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Arquivos ({files.length})</button>
                        <div className="flex-1"></div>
                        <button onClick={() => setShowDesktopLogs(false)} className="px-2 text-gray-500 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                         {terminalSubTab === 'logs' ? <LogPanel logs={logs} isOpen={true} /> : <FilePanel files={files} projectName={currentProject?.name} onDeleteFile={handleDeleteFile} />}
                    </div>
                </div>
            )}
          </div>

          {/* SIDEBAR CHAT (DESKTOP) */}
          {showDesktopChat && (
              <div className="hidden md:flex flex-none w-[380px] bg-gray-950 border-l border-gray-800 z-30 flex-col shadow-2xl">
                   <AIChat onImportFlow={handleImportFlow} logs={logs} nodes={nodes} edges={edges} />
              </div>
          )}

          {/* VIEWS MOBILE (Chat & Terminal - Substitui a view Desktop quando ativo) */}
          <div className={`md:hidden flex-1 ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
             <AIChat onImportFlow={handleImportFlow} logs={logs} nodes={nodes} edges={edges} />
          </div>
          <div className={`md:hidden flex-1 ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
             <div className="flex flex-col h-full bg-gray-950">
                <div className="flex bg-gray-900 p-1 border-b border-gray-800">
                    <button onClick={() => setTerminalSubTab('logs')} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded transition-all ${terminalSubTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Logs</button>
                    <button onClick={() => setTerminalSubTab('files')} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded transition-all ${terminalSubTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Arquivos ({files.length})</button>
                </div>
                <div className="flex-1 overflow-hidden">
                    {terminalSubTab === 'logs' ? <LogPanel logs={logs} isOpen={true} /> : <FilePanel files={files} projectName={currentProject?.name} onDeleteFile={handleDeleteFile} />}
                </div>
             </div>
          </div>

        </main>

        {/* BOTTOM NAV - MOBILE ONLY */}
        <nav className="h-[60px] bg-gray-900 border-t border-gray-800 flex items-center justify-around px-2 shrink-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
          <button onClick={() => setActiveTab('flow')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-1 ${activeTab === 'flow' ? 'text-blue-500' : 'text-gray-500'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
             <span className="text-[9px] font-black uppercase tracking-tighter">Fluxo</span>
          </button>
          <button onClick={() => setActiveTab('chat')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-1 ${activeTab === 'chat' ? 'text-blue-500' : 'text-gray-500'}`}>
             <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
             </div>
             <span className="text-[9px] font-black uppercase tracking-tighter">AI Chat</span>
          </button>
          <button onClick={() => setActiveTab('terminal')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-1 ${activeTab === 'terminal' ? 'text-blue-500' : 'text-gray-500'}`}>
             <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {logs.some(l => l.level === 'ERROR') && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-gray-900"></span>}
             </div>
             <span className="text-[9px] font-black uppercase tracking-tighter">Logs</span>
          </button>
          <button onClick={() => setIsLibraryOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-1 text-gray-500 py-1">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
             <span className="text-[9px] font-black uppercase tracking-tighter">Menu</span>
          </button>
        </nav>

        <NodeConfigPanel node={selectedNode} isOpen={!!selectedNode} onClose={() => setSelectedNodeId(null)} onUpdate={(id, cfg) => setNodes(nds => nds.map(n => n.id === id ? {...n, data: {...n.data, config: cfg}} : n))} onDelete={id => setNodes(nds => nds.filter(n => n.id !== id))} onDuplicate={() => {}} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <ProjectLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onLoadProject={handleLoadProject} currentNodesCount={nodes.length} activeProjectId={currentProject?.id} />
        <FlowJsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} nodes={nodes} edges={edges} onImport={handleImportJson} />
        <ApiTutorialModal isOpen={isApiTutorialOpen} onClose={() => setIsApiTutorialOpen(false)} />
        <WebhookModal isOpen={isWebhookModalOpen} onClose={() => setIsWebhookModalOpen(false)} webhookUrl={webhookUrl || ''} />
      </div>
    </ReactFlowProvider>
  );
};

export default App;

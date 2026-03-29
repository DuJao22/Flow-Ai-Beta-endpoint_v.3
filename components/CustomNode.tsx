
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { NodeStatus, NodeType } from '../types';

const CustomNode = ({ data, isConnectable, selected }: NodeProps) => {
  // Configuração visual baseada no status
  let statusStyles = 'border-gray-600 bg-gray-900'; // Default mais escuro
  let statusLabel = null;
  let statusIcon = null;

  switch (data.status as NodeStatus) {
    case NodeStatus.RUNNING:
      // Amarelo BEM forte e pulsante
      statusStyles = 'border-yellow-400 bg-yellow-900 shadow-[0_0_20px_rgba(250,204,21,0.6)] ring-2 ring-yellow-400 animate-pulse z-50';
      statusLabel = (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-50">
             <span className="bg-yellow-400 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg animate-bounce flex items-center gap-1">
                <span className="animate-spin w-2 h-2 border-2 border-black border-t-transparent rounded-full"></span>
                PROCESSANDO
             </span>
        </div>
      );
      statusIcon = <span className="animate-spin h-3 w-3 border-2 border-yellow-500 border-t-transparent rounded-full mr-2"></span>;
      break;

    case NodeStatus.SUCCESS:
      statusStyles = 'border-green-500 bg-green-900/50 shadow-[0_0_15px_rgba(34,197,94,0.4)]';
      statusIcon = <span className="text-green-400 mr-2 font-bold">✓</span>;
      break;

    case NodeStatus.ERROR:
      statusStyles = 'border-red-500 bg-red-900/60 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
      statusIcon = <span className="text-red-400 mr-2 font-bold">✕</span>;
      statusLabel = (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
             <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                FALHOU
             </span>
        </div>
      );
      break;
      
    case NodeStatus.IDLE:
    default:
      if (selected) {
          statusStyles = 'border-blue-400 bg-gray-800 ring-2 ring-blue-500 shadow-lg';
      } else {
          statusStyles = 'border-gray-600 bg-gray-800 hover:border-gray-500';
      }
      statusIcon = <div className={`rounded-full w-2 h-2 mr-2 ${selected ? 'bg-blue-400' : 'bg-gray-600'}`}></div>;
      break;
  }

  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[180px] transition-all duration-200 relative group ${statusStyles}`}>
      
      {statusLabel}

      <div className="flex items-center">
        {statusIcon}
        <div className="flex flex-col overflow-hidden">
          <div className="text-sm font-bold text-gray-100 truncate max-w-[160px]" title={data.label}>
            {data.label}
          </div>
          <div className="text-[9px] text-gray-400 uppercase tracking-widest font-mono mt-0.5">
            {data.type}
          </div>
        </div>
      </div>

      {/* Inputs (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-gray-400 border-2 border-gray-900 hover:bg-white transition-colors"
      />

      {/* Outputs (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-gray-400 border-2 border-gray-900 hover:bg-white transition-colors"
      />
    </div>
  );
};

export default memo(CustomNode);

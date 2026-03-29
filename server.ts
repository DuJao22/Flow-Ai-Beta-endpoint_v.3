import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { FlowEngine } from "./services/flowEngine";
import { FlowNode, FlowEdge, LogEntry, GeneratedFile, NodeType } from "./types";

const FLOWS_FILE = path.join(process.cwd(), "flows.json");

// Helper to load flows from server-side storage
function loadFlows(): Record<string, { nodes: FlowNode[], edges: FlowEdge[] }> {
  try {
    if (fs.existsSync(FLOWS_FILE)) {
      const data = fs.readFileSync(FLOWS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Erro ao carregar fluxos do servidor:", e);
  }
  return {};
}

// Helper to save flows to server-side storage
function saveFlows(flows: Record<string, { nodes: FlowNode[], edges: FlowEdge[] }>) {
  try {
    fs.writeFileSync(FLOWS_FILE, JSON.stringify(flows, null, 2));
  } catch (e) {
    console.error("Erro ao salvar fluxos no servidor:", e);
  }
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Endpoint para salvar um fluxo no servidor e obter um Webhook ID
  app.post("/api/save-flow", (req, res) => {
    try {
      const { id, nodes, edges } = req.body;
      if (!id || !nodes || !edges) {
        return res.status(400).json({ error: "ID, nodes e edges são obrigatórios." });
      }

      const flows = loadFlows();
      flows[id] = { nodes, edges };
      saveFlows(flows);

      res.json({ success: true, message: "Fluxo salvo no servidor.", webhookUrl: `/api/trigger/${id}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint de Gatilho (Webhook) - Executa um fluxo salvo via GET ou POST
  app.all("/api/trigger/:flowId", async (req, res) => {
    try {
      const { flowId } = req.params;
      const flows = loadFlows();
      const flow = flows[flowId];

      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado no servidor." });
      }

      const logs: LogEntry[] = [];
      const files: GeneratedFile[] = [];
      let currentNodes = [...flow.nodes];

      // Callbacks simulados para o FlowEngine no backend
      const setNodes = (updateFn: any) => {
        if (typeof updateFn === 'function') {
          currentNodes = updateFn(currentNodes);
        } else {
          currentNodes = updateFn;
        }
      };

      const addLog = (log: LogEntry) => {
        logs.push(log);
      };

      const onFileGenerated = (file: GeneratedFile) => {
        files.push(file);
      };

      const engine = new FlowEngine(
        currentNodes,
        flow.edges,
        setNodes,
        addLog,
        onFileGenerated
      );

      // Injeta os dados da requisição no contexto inicial
      engine.context['webhook_data'] = { 
          query: req.query, 
          body: req.body,
          headers: req.headers,
          method: req.method
      };

      // Executa o fluxo
      await engine.run();

      res.json({
        success: true,
        message: "Fluxo executado via gatilho.",
        logs,
        files
      });

    } catch (error: any) {
      console.error("Erro no gatilho do fluxo:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Endpoint para executar o fluxo via POST direto (sem salvar)
  app.post("/api/execute-flow", async (req, res) => {
    try {
      const { nodes, edges } = req.body;

      if (!nodes || !Array.isArray(nodes)) {
        return res.status(400).json({ error: "O corpo da requisição deve conter um array 'nodes'." });
      }

      if (!edges || !Array.isArray(edges)) {
        return res.status(400).json({ error: "O corpo da requisição deve conter um array 'edges'." });
      }

      const logs: LogEntry[] = [];
      const files: GeneratedFile[] = [];
      let currentNodes = [...nodes];

      // Callbacks simulados para o FlowEngine no backend
      const setNodes = (updateFn: any) => {
        if (typeof updateFn === 'function') {
          currentNodes = updateFn(currentNodes);
        } else {
          currentNodes = updateFn;
        }
      };

      const addLog = (log: LogEntry) => {
        logs.push(log);
      };

      const onFileGenerated = (file: GeneratedFile) => {
        files.push(file);
      };

      const engine = new FlowEngine(
        currentNodes,
        edges,
        setNodes,
        addLog,
        onFileGenerated
      );

      // Injeta os dados extras da requisição no contexto se existirem
      if (req.body.data) {
          engine.context['webhook_data'] = req.body.data;
      }

      // Executa o fluxo
      await engine.run();

      // Retorna o resultado da execução
      res.json({
        success: true,
        message: "Fluxo executado com sucesso.",
        logs,
        files,
        finalNodesState: currentNodes
      });

    } catch (error: any) {
      console.error("Erro na execução do fluxo via API:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Erro interno na execução do fluxo."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

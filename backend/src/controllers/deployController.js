const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

const ghApi = axios.create({
  baseURL: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  timeout: 15000,
});

const WORKFLOWS = {
  qa: 'deploy-qa.yml',
  prod: 'deploy-prod.yml',
  ci: 'ci.yml',
};

// GET /api/deploy/status
exports.getStatus = async (req, res) => {
  try {
    const [qaRuns, prodRuns] = await Promise.all([
      ghApi.get(`/actions/workflows/${WORKFLOWS.qa}/runs?per_page=5`),
      ghApi.get(`/actions/workflows/${WORKFLOWS.prod}/runs?per_page=5`),
    ]);

    const formatRun = (run) => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      sha: run.head_sha?.slice(0, 7),
      branch: run.head_branch,
      message: run.head_commit?.message?.split('\n')[0],
      author: run.head_commit?.author?.name,
      startedAt: run.created_at,
      updatedAt: run.updated_at,
      url: run.html_url,
      duration:
        run.updated_at && run.created_at
          ? Math.round((new Date(run.updated_at) - new Date(run.created_at)) / 1000)
          : null,
    });

    res.json({
      success: true,
      data: {
        qa: qaRuns.data.workflow_runs.map(formatRun),
        prod: prodRuns.data.workflow_runs.map(formatRun),
      },
    });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(502).json({ success: false, error: `GitHub API error: ${msg}` });
  }
};

// POST /api/deploy/trigger-qa
exports.triggerQA = async (req, res) => {
  const { reason = 'Deploy manual desde SuperAdmin' } = req.body;
  try {
    await ghApi.post(`/actions/workflows/${WORKFLOWS.qa}/dispatches`, {
      ref: 'develop',
      inputs: { reason },
    });
    res.json({ success: true, message: 'Deploy QA iniciado correctamente' });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(502).json({ success: false, error: `No se pudo iniciar el deploy: ${msg}` });
  }
};

// POST /api/deploy/trigger-prod
exports.triggerProd = async (req, res) => {
  const { confirm, reason } = req.body;
  if (confirm !== 'PRODUCCION') {
    return res.status(400).json({ success: false, error: 'Debes escribir PRODUCCION para confirmar' });
  }
  if (!reason?.trim()) {
    return res.status(400).json({ success: false, error: 'El motivo del deploy es requerido' });
  }
  try {
    await ghApi.post(`/actions/workflows/${WORKFLOWS.prod}/dispatches`, {
      ref: 'main',
      inputs: { confirm, reason },
    });
    res.json({ success: true, message: 'Deploy a Producción iniciado correctamente' });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(502).json({ success: false, error: `No se pudo iniciar el deploy: ${msg}` });
  }
};

// GET /api/deploy/run/:runId/logs-url
exports.getLogsUrl = async (req, res) => {
  const { runId } = req.params;
  try {
    const { data } = await ghApi.get(`/actions/runs/${runId}`);
    res.json({ success: true, data: { url: data.html_url } });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(502).json({ success: false, error: msg });
  }
};

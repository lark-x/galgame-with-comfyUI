import { config } from '../../config.js';
import { fetchSthStart } from './client.js';
import { toArtifactImageReference, isArtifactImage } from './artifacts.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function publicImageError(message, { code = 'sthstart_public_image_error', allowDirectFallback = false, acceptedPublicTask = false } = {}) {
  const error = new Error(message);
  error.code = code;
  error.allowDirectFallback = allowDirectFallback;
  error.acceptedPublicTask = acceptedPublicTask;
  return error;
}

const PUBLIC_NODE_TITLES = {
  artist: '画师串',
  quality: '质量提示词',
  width: '图片的宽',
  height: '图片的长',
  prompt: '画面描述',
};

function publicNodeByTitle(workflow, title) {
  if (!workflow || !Array.isArray(workflow.nodes)) return null;
  return workflow.nodes.find((node) => node?.title === title) || null;
}

function publicWidgetValue(node) {
  return Array.isArray(node?.widgets_values) ? node.widgets_values[0] : undefined;
}

function publicTextValue(node) {
  const value = publicWidgetValue(node);
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function publicNumberValue(node, fallback) {
  const value = Number(publicWidgetValue(node));
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

export function extractPublicGenerationInputs(workflow) {
  const prompt = publicTextValue(publicNodeByTitle(workflow, PUBLIC_NODE_TITLES.prompt));
  if (!prompt || prompt === '请输入画面描述') {
    throw publicImageError('公共图片工作流缺少有效的画面描述', { code: 'sthstart_public_prompt_required' });
  }
  const inputs = {
    prompt,
    width: Math.max(64, Math.min(4096, publicNumberValue(publicNodeByTitle(workflow, PUBLIC_NODE_TITLES.width), config.comfyui.width))),
    height: Math.max(64, Math.min(4096, publicNumberValue(publicNodeByTitle(workflow, PUBLIC_NODE_TITLES.height), config.comfyui.height))),
  };
  const artist = publicTextValue(publicNodeByTitle(workflow, PUBLIC_NODE_TITLES.artist));
  const qualityPrompt = publicTextValue(publicNodeByTitle(workflow, PUBLIC_NODE_TITLES.quality));
  if (artist) inputs.artist = artist;
  if (qualityPrompt) inputs.qualityPrompt = qualityPrompt;
  const negativeNode = workflow?.nodes?.find((node) => node?.title === '负面提示词');
  const negativePrompt = publicTextValue(negativeNode);
  if (negativePrompt) inputs.negativePrompt = negativePrompt;
  const sampler = workflow?.nodes?.find((node) => node?.type === 'KSampler' || node?.type === 'KSamplerAdvanced');
  const rawSeed = Array.isArray(sampler?.widgets_values) ? sampler.widgets_values[0] : undefined;
  const seed = Number(rawSeed);
  return { inputs, seed: Number.isSafeInteger(seed) && seed >= 0 ? seed : null };
}

export async function submitPublicWorkflow(guiWorkflow, onProgress) {
  const business = extractPublicGenerationInputs(guiWorkflow);
  const idempotencyKey = `linshe-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  let response;
  try {
    response = await fetchSthStart('/api/v1/generation/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        purpose: config.publicServices.generationPurpose,
        inputs: business.inputs,
        ...(business.seed === null ? {} : { seed: business.seed }),
        priority: 'normal',
      }),
    }, 15000);
  } catch (error) {
    throw publicImageError(`无法连接 SthStart 公共图片服务: ${error?.message || 'network error'}`, {
      code: 'sthstart_public_unavailable',
      allowDirectFallback: true,
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw publicImageError(`SthStart 公共图片服务拒绝请求 (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`, {
      code: 'sthstart_public_rejected',
    });
  }

  let accepted;
  try {
    accepted = await response.json();
  } catch (error) {
    throw publicImageError(`SthStart 公共图片服务返回了无效响应: ${error?.message || 'invalid JSON'}`, {
      code: 'sthstart_public_protocol_error',
    });
  }

  if (!accepted || typeof accepted !== 'object' || Array.isArray(accepted) || !accepted.id) {
    throw publicImageError('SthStart 公共图片服务未返回任务编号', { code: 'sthstart_public_protocol_error' });
  }

  if (onProgress) onProgress({ phase: 'submitted', promptId: accepted.id });

  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    let taskRes;
    let task;
    try {
      taskRes = await fetchSthStart(`/api/v1/generation/tasks/${encodeURIComponent(accepted.id)}`, { method: 'GET' }, 10000);
      if (!taskRes.ok) {
        const detail = await taskRes.text().catch(() => '');
        throw new Error(`SthStart generation task lookup returned ${taskRes.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`);
      }
      task = await taskRes.json();
    } catch (error) {
      throw publicImageError(`SthStart 公共图片任务查询失败: ${error?.message || 'network error'}`, {
        code: 'sthstart_public_task_error',
        acceptedPublicTask: true,
      });
    }

    if (task.status === 'succeeded') {
      const images = [];
      for (const artifact of task.artifacts || []) {
        const reference = toArtifactImageReference({
          artifactId: artifact.artifactId,
          contentType: artifact.contentType,
          filename: artifact.outputName || artifact.artifactId,
          byteSize: artifact.byteSize,
        });
        if (reference) images.push(reference);
      }
      if (images.length === 0) {
        throw publicImageError(`SthStart 公共图片任务 ${accepted.id} 已完成但没有可用图片`, {
          code: 'sthstart_public_empty_result',
          acceptedPublicTask: true,
        });
      }
      if (onProgress) onProgress({ phase: 'done', promptId: accepted.id, imageCount: images.length, progress: 1 });
      console.log(`[sthstart-public-image] completed task ${accepted.id} with ${images.length} artifact reference(s)`);
      return { images, promptId: accepted.id, source: 'sthstart-public' };
    }

    if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'abandoned') {
      throw publicImageError(task.errorMessage || `SthStart generation task ${task.status}`, {
        code: 'sthstart_public_task_failed',
        acceptedPublicTask: true,
      });
    }

    await sleep(1000);
  }

  throw publicImageError(`SthStart 公共图片任务 ${accepted.id} 超时`, {
    code: 'sthstart_public_task_timeout',
    acceptedPublicTask: true,
  });
}

export async function downloadPublicArtifact(artifactId) {
  if (!config.publicServices.image || !config.publicServices.appToken || !isArtifactImage({ artifactId })) {
    throw new Error('SthStart 公共图片产物不可用');
  }
  const response = await fetchSthStart(`/api/v1/artifacts/${encodeURIComponent(artifactId)}`, {
    headers: { Accept: 'image/*' },
  }, 30000);
  if (!response.ok) throw new Error(`SthStart 公共图片产物读取失败 (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

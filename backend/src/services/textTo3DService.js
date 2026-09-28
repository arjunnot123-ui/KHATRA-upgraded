/**
 * KHATRA Text-to-3D Provider Service
 * ─────────────────────────────────
 * Implements a provider-ready architecture for Text-to-3D model generation and management:
 *  - Provider Abstraction: Meshy, Luma, and Local/Upload Provider
 *  - Strict server-side credential isolation (never sent to client)
 *  - Standardized industrial safety prompt template:
 *    "Create a [OBJECT] in a [STYLE] style, made from [MATERIAL], with a [SHAPE/FORM], designed for [USE CASE]."
 *  - GLB/GLTF model validation: magic bytes check, file extension check, safe path validation, mobile size limits
 *  - Works deterministically even if no external provider API key is configured.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as aiService from './aiService.js';

const MESHY_API_URL = 'https://api.meshy.ai/v2/text-to-3d';
const LUMA_API_URL = 'https://api.lumalabs.ai/dream-machine/v1/generations';

const MAX_MODEL_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max limit for mobile-friendly assets
const GLB_MAGIC_HEADER = Buffer.from([0x67, 0x6C, 0x54, 0x46]); // "glTF" in ASCII

// ── Provider Credentials Helpers ─────────────────────────────────────────────

function meshyKey() {
  return process.env.MESHY_API_KEY || '';
}

function lumaKey() {
  return process.env.LUMA_API_KEY || '';
}

export function getProviderInfo() {
  const active = [];
  if (meshyKey()) active.push('meshy');
  if (lumaKey()) active.push('luma');
  active.push('local'); // Local/upload provider is always active

  const primary = process.env.TEXT_TO_3D_PROVIDER || (meshyKey() ? 'meshy' : lumaKey() ? 'luma' : 'local');

  return {
    provider: primary,
    configured: Boolean(meshyKey() || lumaKey()),
    availableProviders: active,
  };
}

// ── Prompt Formatting & Generation ───────────────────────────────────────────

/**
 * Combine components into the exact required template:
 * "Create a [OBJECT] in a [STYLE] style, made from [MATERIAL], with a [SHAPE/FORM], designed for [USE CASE]."
 */
export function formatPromptTemplate({ object, style, material, shape, useCase }) {
  const obj = (object || 'industrial machine').trim().replace(/^[aA]\s+/, '');
  const sty = (style || 'rugged industrial').trim();
  const mat = (material || 'reinforced steel and durable polymer').trim();
  const shp = (shape || 'modular heavy-duty rectangular form').trim();
  const usc = (useCase || 'interactive worker safety training and AR machine inspection').trim();

  return `Create a ${obj} in a ${sty} style, made from ${mat}, with a ${shp}, designed for ${usc}.`;
}

/**
 * Generate a production-ready 3D prompt using template or AI assistance.
 */
export async function generateStudioPrompt({ object, style, material, shape, useCase, description }) {
  // If specific template components are provided, build the structured prompt
  if (object || style || material || shape || useCase) {
    const prompt = formatPromptTemplate({ object, style, material, shape, useCase });
    return {
      prompt,
      components: {
        object: object || 'industrial machine',
        style: style || 'rugged industrial',
        material: material || 'reinforced steel',
        shape: shape || 'modular heavy-duty form',
        useCase: useCase || 'interactive worker safety training',
      },
    };
  }

  // If a freeform description is given, use backend AI or fallback template
  const desc = (description || 'mining conveyor with emergency stop and drive motor').trim();
  if (aiService.isConfigured()) {
    try {
      const prompt = await aiService.generate3DPrompt(desc);
      return { prompt, components: null };
    } catch {
      // Fallback below
    }
  }

  return {
    prompt: formatPromptTemplate({
      object: desc,
      style: 'rugged industrial',
      material: 'reinforced steel and durable rubber',
      shape: 'modular heavy-duty engineering form',
      useCase: 'interactive worker safety training and AR machine inspection',
    }),
    components: null,
  };
}

// ── Model File Validation & Storage ──────────────────────────────────────────

/**
 * Validates model buffer against security rules and GLTF/GLB specifications.
 */
export function validateModelBuffer(buffer, originalFilename = '') {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('INVALID_BUFFER');
  }

  if (buffer.length === 0) {
    throw new Error('EMPTY_MODEL_FILE');
  }

  if (buffer.length > MAX_MODEL_SIZE_BYTES) {
    throw new Error(`MODEL_TOO_LARGE: Model file exceeds 25 MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)} MB). Optimize mesh and textures for mobile.`);
  }

  // Prevent directory traversal or invalid extension
  const ext = path.extname(originalFilename || '').toLowerCase();
  if (ext && ext !== '.glb' && ext !== '.gltf') {
    throw new Error('INVALID_FILE_TYPE: Only .glb and .gltf files are supported.');
  }

  // Validate magic bytes for binary GLB
  const isGLB = buffer.length >= 4 && buffer.subarray(0, 4).equals(GLB_MAGIC_HEADER);
  let isGLTFJson = false;

  if (!isGLB) {
    try {
      const textPreview = buffer.subarray(0, 500).toString('utf-8');
      if (textPreview.trim().startsWith('{') && textPreview.includes('asset')) {
        isGLTFJson = true;
      }
    } catch {
      // ignore
    }
  }

  if (!isGLB && !isGLTFJson) {
    throw new Error('INVALID_GLTF_STRUCTURE: File header does not match a valid binary GLB or glTF JSON container.');
  }

  return {
    valid: true,
    isGLB,
    isGLTF: isGLTFJson,
    sizeBytes: buffer.length,
    extension: isGLB ? '.glb' : '.gltf',
  };
}

/**
 * Safely saves a model file to public/models/custom/ with a collision-free UUID name.
 */
export async function saveCustomModelFile(buffer, originalFilename, modelsDir) {
  const validation = validateModelBuffer(buffer, originalFilename);

  // Generate safe filename without path traversal risk
  const fileId = crypto.randomUUID();
  const safeFilename = `${fileId}${validation.extension}`;
  const targetDir = path.join(modelsDir, 'custom');

  await fs.mkdir(targetDir, { recursive: true });
  const finalPath = path.join(targetDir, safeFilename);

  await fs.writeFile(finalPath, buffer);

  return {
    fileId,
    safeFilename,
    modelUrl: `/models/custom/${safeFilename}`,
    fileSizeBytes: validation.sizeBytes,
  };
}

// ── Provider Execution Abstraction ───────────────────────────────────────────

/**
 * Request Text-to-3D generation through Meshy, Luma, or Local provider.
 */
export async function startModelGeneration({ prompt, provider }) {
  const chosenProvider = provider || getProviderInfo().provider;

  if (chosenProvider === 'meshy') {
    const key = meshyKey();
    if (!key) {
      return {
        success: false,
        error: 'MESHY_KEY_MISSING',
        message: 'Meshy API key is not configured in backend/.env.',
        provider: 'meshy',
      };
    }

    try {
      const res = await fetch(MESHY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          mode: 'preview',
          prompt: prompt.trim(),
          art_style: 'realistic',
          should_remesh: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: 'MESHY_API_ERROR',
          message: data.message || 'Failed to submit generation task to Meshy.',
        };
      }

      return {
        success: true,
        taskId: data.result,
        provider: 'meshy',
        status: 'IN_PROGRESS',
      };
    } catch (err) {
      return { success: false, error: 'MESHY_NETWORK_ERROR', message: err.message };
    }
  }

  if (chosenProvider === 'luma') {
    const key = lumaKey();
    if (!key) {
      return {
        success: false,
        error: 'LUMA_KEY_MISSING',
        message: 'Luma API key is not configured in backend/.env.',
        provider: 'luma',
      };
    }

    try {
      const res = await fetch(LUMA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: 'LUMA_API_ERROR',
          message: data.message || 'Failed to submit generation task to Luma.',
        };
      }

      return {
        success: true,
        taskId: data.id,
        provider: 'luma',
        status: 'IN_PROGRESS',
      };
    } catch (err) {
      return { success: false, error: 'LUMA_NETWORK_ERROR', message: err.message };
    }
  }

  // Local Studio Mode (No external API key)
  return {
    success: false,
    error: 'NO_EXTERNAL_PROVIDER_CONFIGURED',
    message: 'No external Text-to-3D provider API key (Meshy/Luma) is set in backend/.env. You can copy this generated prompt to use in Meshy, Tripo, or Luma, or upload a custom .glb/.gltf model directly.',
    provider: 'local',
  };
}

/**
 * Poll generation status for Meshy / Luma tasks.
 */
export async function queryGenerationStatus(taskId, provider = 'meshy') {
  if (provider === 'meshy') {
    const key = meshyKey();
    if (!key) throw new Error('MESHY_KEY_MISSING');
    const res = await fetch(`${MESHY_API_URL}/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to query Meshy status.');

    return {
      taskId,
      status: data.status, // PENDING, IN_PROGRESS, SUCCEEDED, FAILED
      progress: data.progress || 0,
      modelUrl: data.model_urls?.glb || null,
      thumbnailUrl: data.thumbnail_url || null,
    };
  }

  if (provider === 'luma') {
    const key = lumaKey();
    if (!key) throw new Error('LUMA_KEY_MISSING');
    const res = await fetch(`${LUMA_API_URL}/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to query Luma status.');

    return {
      taskId,
      status: data.state, // queued, dreaming, completed, failed
      progress: data.state === 'completed' ? 100 : 50,
      modelUrl: data.assets?.glb || null,
      thumbnailUrl: null,
    };
  }

  throw new Error('UNKNOWN_PROVIDER');
}

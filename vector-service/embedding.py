"""Jina v2 base zh ONNX 嵌入推理（模型来自 https://huggingface.co/Xenova/jina-embeddings-v2-base-zh）

聊天和索引共用一个 ONNX 会话，避免同一模型在一个 Python 进程中常驻两份。
"""

import platform
import threading

import numpy as np
from transformers import AutoTokenizer
import onnxruntime as ort

from config import (
    MODEL_PATH,
    USE_QUANTIZED,
    EMBED_MAX_LENGTH,
    EMBED_NUM_THREADS,
    EMBED_BATCH_SIZE,
    EMBED_PREFER_GPU,
    EMBED_EXECUTION_PROVIDER,
)

_tokenizer = None
_session = None
_tokenizer_lock = threading.Lock()
_session_lock = threading.Lock()
_inference_lock = threading.Lock()

# 优先使用的 GPU 执行后端（按顺序），都没有时退回 CPU
_GPU_PROVIDER_PRIORITY = ("CUDAExecutionProvider", "DmlExecutionProvider", "TensorrtExecutionProvider")
_PROVIDER_ALIASES = {
    "cpu": "CPUExecutionProvider",
    "coreml": "CoreMLExecutionProvider",
    "cuda": "CUDAExecutionProvider",
    "directml": "DmlExecutionProvider",
    "tensorrt": "TensorrtExecutionProvider",
}


def _select_providers(available: list[str]) -> list[str]:
    """只启用经过选择的后端，绝不把 ORT 的全部后端直接透传。

    特别是 macOS 上，CoreML 必须显式选择。此前的 list(available) 会让
    CoreML 在无 CUDA/DirectML 时被意外排到首位，造成模型编译内存暴涨。
    """
    cpu = ["CPUExecutionProvider"] if "CPUExecutionProvider" in available else []
    configured = EMBED_EXECUTION_PROVIDER

    if configured != "auto":
        requested = _PROVIDER_ALIASES.get(configured)
        if requested and requested in available:
            return [requested] + [provider for provider in cpu if provider != requested]
        print(f"[embedding] requested provider '{configured}' unavailable; falling back to CPU")
        return cpu

    # CoreML is intentionally excluded from automatic selection. Its graph
    # compilation peak for this model can exceed the memory of a 16 GB Mac.
    if platform.system() == "Darwin" or not EMBED_PREFER_GPU:
        return cpu
    preferred = [provider for provider in _GPU_PROVIDER_PRIORITY if provider in available]
    return preferred + [provider for provider in cpu if provider not in preferred]


def _get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        with _tokenizer_lock:
            if _tokenizer is None:
                _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    return _tokenizer


def _get_session(kind="chat"):
    global _session
    if _session is not None:
        return _session

    with _session_lock:
        # FastAPI 会在线程池中执行同步路由。双重检查可防止聊天和索引的
        # 首次请求并发到达时，各自加载一份数百 MB 的模型。
        if _session is not None:
            return _session

        # 选择合适的 ONNX 模型文件
        if USE_QUANTIZED:
            model_file = f"{MODEL_PATH}/onnx/model_int8.onnx"
        else:
            model_file = f"{MODEL_PATH}/onnx/model.onnx"

        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = EMBED_NUM_THREADS
        sess_options.inter_op_num_threads = 1
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        available = ort.get_available_providers()
        ordered = _select_providers(available)
        if not ordered:
            raise RuntimeError(f"No supported ONNX Runtime provider available: {available}")

        try:
            _session = ort.InferenceSession(model_file, sess_options=sess_options, providers=ordered)
        except Exception as exc:
            if ordered != ["CPUExecutionProvider"] and "CPUExecutionProvider" in available:
                print(f"[embedding:{kind}] selected provider unavailable ({exc}), falling back to CPU")
                _session = ort.InferenceSession(
                    model_file, sess_options=sess_options, providers=["CPUExecutionProvider"]
                )
            else:
                raise

        print(
            f"[embedding:{kind}] shared ONNX session loaded, providers={_session.get_providers()}, "
            f"threads={EMBED_NUM_THREADS}, max_length={EMBED_MAX_LENGTH}, "
            f"batch_size={EMBED_BATCH_SIZE}, model={model_file}"
        )
    return _session


def _embed_batch(texts: list[str], tokenizer, session) -> list[list[float]]:
    """执行一个受限批次，控制 Transformer 中间张量的峰值内存。"""
    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=EMBED_MAX_LENGTH,
        return_tensors="np",
    )

    model_inputs = [inp.name for inp in session.get_inputs()]
    session_inputs = {}
    for key in model_inputs:
        if key in encoded:
            session_inputs[key] = encoded[key]
        elif key == "token_type_ids":
            session_inputs[key] = np.zeros_like(encoded["input_ids"])

    # 本地服务优先保证内存稳定。多个 1024-token 批次并发执行会各自申请
    # Transformer 中间张量，在小内存机器上形成叠加峰值。
    with _inference_lock:
        hidden = session.run(None, session_inputs)[0]
    mask = encoded["attention_mask"][:, :, None].astype(hidden.dtype)
    pooled = (hidden * mask).sum(axis=1) / mask.sum(axis=1)
    norm = np.linalg.norm(pooled, axis=1, keepdims=True)
    return (pooled / (norm + 1e-9)).tolist()


def embed(texts: list[str], kind: str = "chat") -> list[list[float]]:
    """将文本列表批量转换为嵌入向量（768 维）。kind: chat=聊天流, index=记忆整理。"""
    if not texts:
        return []

    tokenizer = _get_tokenizer()
    session = _get_session(kind)

    results = []
    for start in range(0, len(texts), EMBED_BATCH_SIZE):
        results.extend(_embed_batch(list(texts[start:start + EMBED_BATCH_SIZE]), tokenizer, session))
    return results


def embed_single(text: str, kind: str = "chat") -> list[float]:
    """单文本嵌入。"""
    return embed([text], kind)[0]

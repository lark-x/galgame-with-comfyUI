import os
import platform

# ChromaDB
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "memory_fragments")

# ONNX Embedding
MODEL_PATH = os.getenv("MODEL_PATH", "./models/jina-embeddings-v2-base-zh")
USE_QUANTIZED = os.getenv("USE_QUANTIZED", "true").lower() == "true"

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8765"))

# ONNX Embedding 调优
EMBED_MAX_LENGTH = int(os.getenv("EMBED_MAX_LENGTH", "1024"))   # 输入最大 token 数（原 8192 过重）
EMBED_PREFER_GPU = os.getenv("EMBED_PREFER_GPU", "true").lower() == "true"  # 优先 CUDA/DirectML
# macOS 的 CoreML Execution Provider 在加载该 Transformer 模型时可能产生数 GB
# 的编译峰值，因此默认明确使用 CPU。CoreML 只能通过环境变量主动开启。
_default_provider = "cpu" if platform.system() == "Darwin" else "auto"
EMBED_EXECUTION_PROVIDER = os.getenv("EMBED_EXECUTION_PROVIDER", _default_provider).strip().lower()

# chat/index 共用同一个 ONNX 会话，避免同一模型常驻两份。
# 保留旧线程变量作为升级兼容，但新配置优先。
EMBED_NUM_THREADS = int(os.getenv(
    "EMBED_NUM_THREADS",
    os.getenv("EMBED_INDEX_NUM_THREADS", os.getenv("EMBED_CHAT_NUM_THREADS", "2")),
))

# 大批量长文本会让 Transformer 中间张量急剧膨胀；分块限制单次推理峰值。
EMBED_BATCH_SIZE = max(1, int(os.getenv("EMBED_BATCH_SIZE", "4")))

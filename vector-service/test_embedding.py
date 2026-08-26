import unittest
from unittest.mock import call, patch

import embedding


class ProviderSelectionTests(unittest.TestCase):
    def test_macos_auto_never_selects_coreml(self):
        available = ["CoreMLExecutionProvider", "AzureExecutionProvider", "CPUExecutionProvider"]
        with patch.object(embedding, "EMBED_EXECUTION_PROVIDER", "auto"), \
                patch.object(embedding.platform, "system", return_value="Darwin"):
            self.assertEqual(embedding._select_providers(available), ["CPUExecutionProvider"])

    def test_coreml_requires_explicit_opt_in(self):
        available = ["CoreMLExecutionProvider", "CPUExecutionProvider"]
        with patch.object(embedding, "EMBED_EXECUTION_PROVIDER", "coreml"):
            self.assertEqual(
                embedding._select_providers(available),
                ["CoreMLExecutionProvider", "CPUExecutionProvider"],
            )

    def test_unknown_provider_falls_back_to_cpu(self):
        with patch.object(embedding, "EMBED_EXECUTION_PROVIDER", "not-a-provider"):
            self.assertEqual(
                embedding._select_providers(["CoreMLExecutionProvider", "CPUExecutionProvider"]),
                ["CPUExecutionProvider"],
            )

    def test_large_requests_are_split_into_bounded_batches(self):
        texts = [f"text-{index}" for index in range(10)]
        with patch.object(embedding, "EMBED_BATCH_SIZE", 4), \
                patch.object(embedding, "_get_tokenizer", return_value="tokenizer"), \
                patch.object(embedding, "_get_session", return_value="session"), \
                patch.object(embedding, "_embed_batch", side_effect=lambda batch, *_: batch) as run_batch:
            self.assertEqual(embedding.embed(texts, "index"), texts)
            self.assertEqual(
                run_batch.call_args_list,
                [
                    call(texts[0:4], "tokenizer", "session"),
                    call(texts[4:8], "tokenizer", "session"),
                    call(texts[8:10], "tokenizer", "session"),
                ],
            )


if __name__ == "__main__":
    unittest.main()

"""
Bedrock-backed drop-in adapter for the anthropic client interface.

Exposes `.messages.create(model, max_tokens, system, messages)` returning an
object with `.content[0].text` and `.usage.input_tokens / .output_tokens`,
so services written against `anthropic.Anthropic` can run on AWS Bedrock
(Converse API) without touching their call sites.
"""

import os
import logging
from types import SimpleNamespace
from typing import Optional

import boto3

logger = logging.getLogger(__name__)


class _Messages:
    def __init__(self, client):
        self._client = client

    def create(self, model: str, max_tokens: int, system: str, messages: list):
        # El adaptador solo soporta mensajes de texto (lo unico que usan
        # classification_service y special_regime_service)
        converse_messages = [
            {"role": m["role"], "content": [{"text": m["content"]}]}
            for m in messages
        ]
        response = self._client.converse(
            modelId=model,
            system=[{"text": system}],
            messages=converse_messages,
            inferenceConfig={"maxTokens": max_tokens},
        )
        text = response["output"]["message"]["content"][0]["text"]
        usage = response.get("usage", {})
        return SimpleNamespace(
            content=[SimpleNamespace(text=text)],
            usage=SimpleNamespace(
                input_tokens=usage.get("inputTokens", 0),
                output_tokens=usage.get("outputTokens", 0),
            ),
        )


class BedrockAnthropicAdapter:
    """anthropic.Anthropic-compatible client backed by Bedrock Converse."""

    def __init__(self, client):
        self.messages = _Messages(client)


def create_bedrock_anthropic_client() -> Optional[BedrockAnthropicAdapter]:
    """Returns the adapter if BEDROCK_* credentials are set, else None."""
    access_key = os.getenv("BEDROCK_ACCESS_KEY_ID")
    secret_key = os.getenv("BEDROCK_SECRET_ACCESS_KEY")
    region = os.getenv("BEDROCK_REGION", "us-east-1")

    if not (access_key and secret_key):
        return None

    client = boto3.client(
        "bedrock-runtime",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    logger.info(f"Bedrock anthropic-adapter initialized (region: {region})")
    return BedrockAnthropicAdapter(client)

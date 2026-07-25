"""Test Leviathan API Key Generation, Validation, and OpenAI-Compatible Chat Gateway."""
import asyncio
import json
import httpx
from brain.api_keys import generate_api_key, validate_api_key, list_api_keys
from brain.gateway import gateway

async def test_full_pipeline():
    print("=== 1. Testing Key Generation ===")
    key_data = generate_api_key(label="Desknomads AI App Test")
    raw_key = key_data["key"]
    key_id = key_data["id"]
    print(f"[OK] Generated Key: {raw_key} (ID: {key_id})")

    print("\n=== 2. Testing Key Validation ===")
    valid, ident = validate_api_key(raw_key)
    assert valid is True, "Generated key validation failed!"
    print(f"[OK] Key Validation Success: Ident = {ident}")

    print("\n=== 3. Testing Key List ===")
    keys_list = list_api_keys()
    print(f"[OK] Total Active Keys in Vault: {len(keys_list)}")

    print("\n=== 4. Testing Multi-Provider Chat Execution ===")
    res = await gateway.chat_completion(
        messages=[{"role": "user", "content": "Return 'Leviathan Gateway 24x7 Verified'."}],
        model="auto",
        system_prompt="You are testing 24x7 API gateway reliability."
    )
    print(f"[OK] Gateway Status: Success = {res.get('success')}")
    print(f"[OK] Provider Used: {res.get('provider')}")
    print(f"[OK] Model Used: {res.get('model')}")
    print(f"[OK] Reply: {res.get('reply')[:120]}...")

if __name__ == "__main__":
    asyncio.run(test_full_pipeline())

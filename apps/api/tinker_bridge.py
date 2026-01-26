import os
import sys
import json
import tinker
from tinker import types
from transformers import AutoTokenizer

# Standardized Tinker Bridge for Production
# This script is called by the TypeScript API via subprocess

def format_prompt(input_text, system_prompt=None):
    if system_prompt:
        return f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{input_text}<|im_end|>\n<|im_start|>assistant\n"
    return f"<|im_start|>user\n{input_text}<|im_end|>\n<|im_start|>assistant\n"

def sample_model(model_path, user_input, system_prompt=None, max_tokens=500, temperature=0.2):
    api_key = os.getenv("TINKER_API_KEY")
    if not api_key:
        print("Error: TINKER_API_KEY not found in environment.", file=sys.stderr)
        sys.exit(1)
        
    service_client = tinker.ServiceClient(api_key=api_key)
    sampling_client = service_client.create_sampling_client(model_path=model_path)
    
    # Heuristic for the tokenizer ID based on the base model used in training
    # For Qwen/Qwen3 models, we use the specific tokenizer ID
    tokenizer_id = "Qwen/Qwen3-VL-30B-A3B-Instruct"
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_id, trust_remote_code=True)
    
    formatted_prompt = format_prompt(user_input, system_prompt)
    prompt_input = types.ModelInput.from_ints(tokenizer.encode(formatted_prompt, add_special_tokens=True))
    
    sampling_params = types.SamplingParams(
        max_tokens=max_tokens,
        temperature=temperature,
        stop=["<|im_end|>"]
    )
    
    future = sampling_client.sample(
        prompt=prompt_input,
        sampling_params=sampling_params,
        num_samples=1
    )
    result = future.result()
    
    if result.sequences:
        output = tokenizer.decode(result.sequences[0].tokens).strip()
        # Remove the <|im_end|> if it leaked through
        if output.endswith("<|im_end|>"):
            output = output[:-10].strip()
        return output
    return ""

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python tinker_bridge.py <model_path> <user_input> [system_prompt]", file=sys.stderr)
        sys.exit(1)
        
    model_path = sys.argv[1]
    user_input = sys.argv[2]
    system_prompt = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        output = sample_model(model_path, user_input, system_prompt)
        print(output)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

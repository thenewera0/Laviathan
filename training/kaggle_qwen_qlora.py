"""Kaggle: QLoRA fine-tune Qwen2.5-Coder-7B on leviathan_train.jsonl -> GGUF.

HOW TO RUN ON KAGGLE
--------------------
1. New Notebook -> Settings -> Accelerator: GPU T4 x2 (or P100). Internet: ON.
2. Add data: upload leviathan_train.jsonl (Add Input -> Upload) OR pull the repo:
   !git clone https://github.com/thenewera0/Laviathan.git
3. Paste this file into a cell (or: %run kaggle_qwen_qlora.py) and run.
4. When done, the GGUF is written to /kaggle/working/gguf/ — download it from
   the Output tab, then serve locally with Ollama (see training/README.md).

Trains with Unsloth (2x faster, ~half the VRAM) using QLoRA (4-bit base +
LoRA adapters). Rows are rendered through Qwen's ChatML template so the
deployed model behaves correctly inside Ollama, which applies ChatML at
inference. Adjust DATA_PATH if your upload lands elsewhere.
"""
import os

# ---------------------------------------------------------------- config
BASE_MODEL   = "unsloth/Qwen2.5-Coder-7B-Instruct"
MAX_SEQ_LEN  = 2048
LORA_RANK    = 16          # 16 is plenty for behavior/format tuning
LORA_ALPHA   = 16
EPOCHS       = 3
LR           = 2e-4
BATCH        = 2
GRAD_ACCUM   = 4           # effective batch = BATCH * GRAD_ACCUM = 8
QUANTS       = ["q4_k_m"]  # add "q5_k_m","q8_0" if you want more variants
OUT_DIR      = "/kaggle/working"
GGUF_DIR     = f"{OUT_DIR}/gguf"

# Find the dataset whether it was uploaded or cloned.
CANDIDATES = [
    "/kaggle/input/leviathan-train/leviathan_train.jsonl",
    "/kaggle/working/Laviathan/leviathan_train.jsonl",
    "leviathan_train.jsonl",
]
DATA_PATH = next((p for p in CANDIDATES if os.path.exists(p)), None)


def install():
    os.system("pip -q install "
              "'unsloth[kaggle] @ git+https://github.com/unslothai/unsloth.git' "
              "trl peft accelerate bitsandbytes datasets")


def main():
    assert DATA_PATH, (
        "leviathan_train.jsonl not found. Upload it as a dataset named "
        "'leviathan-train' or clone the repo into /kaggle/working.")
    print(f"[data] using {DATA_PATH}")

    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template
    from datasets import load_dataset
    from trl import SFTTrainer, SFTConfig

    # --- model (4-bit) + LoRA adapters
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=MAX_SEQ_LEN,
        load_in_4bit=True,
        dtype=None,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        lora_alpha=LORA_ALPHA,
        lora_dropout=0.0,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
        random_state=7,
    )
    tokenizer = get_chat_template(tokenizer, chat_template="qwen-2.5")

    # --- data: Alpaca instruction/input/output -> ChatML text
    def to_text(ex):
        user = ex["instruction"]
        if ex.get("input"):
            user += "\n\n" + ex["input"]
        msgs = [
            {"role": "user", "content": user},
            {"role": "assistant", "content": ex["output"]},
        ]
        return {"text": tokenizer.apply_chat_template(
            msgs, tokenize=False, add_generation_prompt=False)}

    ds = load_dataset("json", data_files=DATA_PATH, split="train")
    ds = ds.map(to_text, remove_columns=ds.column_names)
    print(f"[data] {len(ds)} rows ready")

    # --- train
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        args=SFTConfig(
            dataset_text_field="text",
            max_seq_length=MAX_SEQ_LEN,
            per_device_train_batch_size=BATCH,
            gradient_accumulation_steps=GRAD_ACCUM,
            num_train_epochs=EPOCHS,
            learning_rate=LR,
            warmup_ratio=0.03,
            lr_scheduler_type="cosine",
            logging_steps=10,
            optim="adamw_8bit",
            weight_decay=0.01,
            seed=7,
            output_dir=f"{OUT_DIR}/checkpoints",
            report_to="none",
        ),
    )
    trainer.train()

    # --- export merged GGUF for Ollama
    os.makedirs(GGUF_DIR, exist_ok=True)
    for q in QUANTS:
        print(f"[gguf] exporting {q} ...")
        model.save_pretrained_gguf(GGUF_DIR, tokenizer, quantization_method=q)
    print(f"[done] GGUF written under {GGUF_DIR} — download from the Output tab.")

    # Modelfile so you can `ollama create` immediately after downloading
    with open(f"{GGUF_DIR}/Modelfile", "w", encoding="utf-8") as f:
        gguf = next((n for n in os.listdir(GGUF_DIR) if n.endswith(".gguf")),
                    "model.Q4_K_M.gguf")
        f.write(
            f"FROM ./{gguf}\n"
            'SYSTEM "You are Leviathan — a voice-driven assistant that maps '
            "requests to tool calls, answers stable knowledge directly, and "
            'never invents live data."\n'
            "PARAMETER temperature 0.4\n"
            "PARAMETER stop \"<|im_end|>\"\n"
        )


if __name__ == "__main__":
    install()
    main()

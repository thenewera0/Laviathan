"""Indic augmentation — multiply the English/Hindi register rows into 20+
Indic languages using AI4Bharat IndicTrans2, and add correct number/currency
verbalization rows using AI4Bharat indic-numtowords.

WHY THIS RUNS ON KAGGLE, NOT LOCALLY
------------------------------------
IndicTrans2 is a ~1B-parameter translation model — it needs a GPU and the
model weights, so it belongs in the same Kaggle notebook as training, not in
the local datagen step. This is the honest way to "use" the AI4Bharat repos:
the speech corpora (NPTEL2020, IndicVoices) are ASR data and not used for
text SFT; IndicTrans2 is used as a translation engine; indic-numtowords is
used as a verbalizer. Nothing is hand-forged in a script we can't verify.

USAGE (Kaggle cell, Internet ON, GPU on):
    !pip -q install indic-numtowords
    !git clone https://github.com/AI4Bharat/IndicTrans2.git
    !cd IndicTrans2/huggingface_interface && pip -q install -r requirements.txt
    %run datagen/augment_indic.py           # writes leviathan_train_indic.jsonl
    # then concatenate into the training file:
    !cat leviathan_train_indic.jsonl >> leviathan_train.jsonl

Only rows whose OUTPUT is natural-language prose are translated. Rows whose
output is code, JSON, or a tool_call event are skipped — translating those
would corrupt the contract.
"""
import json
from pathlib import Path

SRC = Path("leviathan_train.jsonl")
DST = Path("leviathan_train_indic.jsonl")

# IndicTrans2 language codes (FLORES-style). Trim/extend as you like.
TARGET_LANGS = {
    "hin_Deva": "Hindi", "tam_Taml": "Tamil", "tel_Telu": "Telugu",
    "ben_Beng": "Bengali", "mar_Deva": "Marathi", "kan_Knda": "Kannada",
    "guj_Gujr": "Gujarati", "pan_Guru": "Punjabi", "mal_Mlym": "Malayalam",
    "ory_Orya": "Odia", "asm_Beng": "Assamese", "urd_Arab": "Urdu",
}
PER_LANG_CAP = 120          # rows translated per language (keep the mix balanced)


def _is_prose(output: str) -> bool:
    o = output.strip()
    if o.startswith(("{", "[", "def ", "async def", "import ", "from ",
                     "class ", "@", "export ", "CREATE ", "DELETE ", "SELECT ")):
        return False
    # skip anything that is mostly code punctuation
    return sum(c in "{};=<>()" for c in o) < len(o) * 0.06


def _prose_rows():
    rows = [json.loads(l) for l in SRC.read_text(encoding="utf-8").splitlines()]
    return [r for r in rows if _is_prose(r["output"]) and len(r["output"]) < 900]


def _load_translator():
    """IndicTrans2 en->indic 1B, via the repo's huggingface_interface helpers."""
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    from IndicTransToolkit.processor import IndicProcessor  # from the cloned repo

    name = "ai4bharat/indictrans2-en-indic-1B"
    tok = AutoTokenizer.from_pretrained(name, trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        name, trust_remote_code=True,
        torch_dtype=torch.float16).to("cuda").eval()
    ip = IndicProcessor(inference=True)

    def translate(texts, tgt):
        batch = ip.preprocess_batch(texts, src_lang="eng_Latn", tgt_lang=tgt)
        enc = tok(batch, truncation=True, padding="longest",
                  return_tensors="pt").to("cuda")
        with torch.no_grad():
            gen = model.generate(**enc, max_length=512, num_beams=5)
        dec = tok.batch_decode(gen, skip_special_tokens=True)
        return ip.postprocess_batch(dec, lang=tgt)

    return translate


def build_translations():
    translate = _load_translator()
    prose = _prose_rows()
    out = []
    for tgt, lang_name in TARGET_LANGS.items():
        subset = prose[:PER_LANG_CAP]
        instr = (f"You are Leviathan. The user is writing in {lang_name}. Reply "
                 f"in {lang_name}, honestly and clearly.")
        # translate inputs and outputs in small batches
        for i in range(0, len(subset), 16):
            chunk = subset[i:i + 16]
            ins = translate([r["input"] for r in chunk], tgt)
            ous = translate([r["output"] for r in chunk], tgt)
            for r, ni, no in zip(chunk, ins, ous):
                out.append({"instruction": instr, "input": ni, "output": no})
        print(f"[indic] {lang_name}: +{len(subset)} rows")
    return out


def build_numwords():
    """Correct number/currency verbalization via indic-numtowords."""
    from num_to_words import num_to_word  # indic-numtowords

    langs = {"hi": "Hindi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali",
             "mr": "Marathi", "kn": "Kannada", "gu": "Gujarati", "pa": "Punjabi"}
    samples = [7, 15, 42, 100, 250, 999, 1500, 10000, 100000, 2500000]
    out = []
    for code, name in langs.items():
        for n in samples:
            try:
                words = num_to_word(n, lang=code)
            except Exception:
                continue
            out.append({
                "instruction": f"Write this number in words in {name}. Output the words only.",
                "input": str(n),
                "output": words,
            })
    print(f"[numwords] +{len(out)} rows")
    return out


def main():
    rows = build_translations() + build_numwords()
    with DST.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[done] {len(rows)} augmented rows -> {DST}")


if __name__ == "__main__":
    main()

const fs = require('fs');
const { HfInference } = require('@huggingface/inference');

const huggingfaceApiKey = "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";
const outputDir = './public';

async function generatePrompts(systemPrompt, transcriptionData, nbMaxNewTokens) {
    const hf = new HfInference(huggingfaceApiKey);
    const inferenceModel = "meta-llama/Meta-Llama-3-70B-Instruct";

    let instructions = "";

    try {
        const response = await hf.textGeneration({
            model: inferenceModel,
            inputs: `${systemPrompt}\n${JSON.stringify(transcriptionData)}\n`,
            parameters: {
                max_new_tokens: nbMaxNewTokens,
                return_full_text: false,
                use_cache: true,
            }
        });

        instructions += response.generated_text;
    } catch (err) {
        console.error(`Error during generation: ${err}`);
        if (`${err}` === "Error: Model is overloaded") {
            instructions = ``;
        }
    }

    instructions = instructions
        .replaceAll("<s>", "")
        .replaceAll("</s>", "")
        .replaceAll("/s>", "")
        .replaceAll("[INST]", "")
        .replaceAll("[/INST]", "")
        .replaceAll("<SYS>", "")
        .replaceAll("<<SYS>>", "")
        .replaceAll("</SYS>", "")
        .replaceAll("<</SYS>>", "")
        .replaceAll('""', '"')
        .replaceAll('`', '')
        .trim();

    let imagePromptsAndTimings;
    try {
        imagePromptsAndTimings = JSON.parse(`[${instructions}]`);
    } catch (error) {
        console.error("Failed to parse LLM response:", error);
        return;
    }

    return imagePromptsAndTimings;
}

async function processTranscription(inputFile, nbMaxNewTokens, uuid, systemPromptPath) {
    const outputFilePath = `${outputDir}/imageprompt_${uuid}.json`;

    if (fs.existsSync(outputFilePath)) {
        console.log(`Image prompt file already exists: ${outputFilePath}`);
        return outputFilePath;
    }

    const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
    const transcriptionData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const imagePromptsAndTimings = await generatePrompts(systemPrompt, transcriptionData, nbMaxNewTokens);

    fs.writeFileSync(outputFilePath, JSON.stringify(imagePromptsAndTimings, null, 2));

    return outputFilePath;
}

module.exports = { processTranscription };
// generatePrompts.js
const fs = require('fs');
const { HfInference } = require('@huggingface/inference');

const huggingfaceApiKey = "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";
const outputDir = './public';

const systemPrompt = `Generate a JSON array of text-to-image prompts with exact start times for a given video caption transcription.

Rules:
1. NOTE: DO NOT say "A Person" in the prompts, describe the individual's characteristics, such as:
   - Age range (e.g., "A young adult in their 20s")
   - Ethnicity or nationality (e.g., "An African American woman")
   - Occupation or role (e.g., "A doctor in a white coat")
   - Physical features (e.g., "A person with short, curly brown hair")
   - Nationality (e.g., "An Indian man or women")
2. Always keep the image charectors to indians unless the character is not obviously indian.
3. Group images to appear at least 5 seconds apart.
4. Prompts must be detailed and descriptive, excluding text, logos, and signs.
5. Response format: JSON array with elements {startInSeconds, prompt}.
6. Omit unnecessary responses like 'Here is the JSON...' or 'I can...'.
7. Ensure valid JSON output.`;



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

async function processTranscription(inputFile, nbMaxNewTokens, uuid) {
    const outputFilePath = `${outputDir}/imageprompt_${uuid}.json`;

    if (fs.existsSync(outputFilePath)) {
        console.log(`Image prompt file already exists: ${outputFilePath}`);
        return outputFilePath;
    }

    const transcriptionData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const imagePromptsAndTimings = await generatePrompts(systemPrompt, transcriptionData, nbMaxNewTokens);

    fs.writeFileSync(outputFilePath, JSON.stringify(imagePromptsAndTimings, null, 2));

    return outputFilePath;
}

module.exports = { processTranscription };

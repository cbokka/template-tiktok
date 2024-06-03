// generateNewsScript.js
const fs = require('fs');
const { HfInference } = require('@huggingface/inference');

const huggingfaceApiKey = "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";
const outputDir = './public';

const systemPrompt = `You will be provided with an RSS feed containing news items, and your task is to transform them into engaging and entertaining news briefs, each under 60 seconds in reading time. Enhance these news items with a creative twist, adding a dash of humor and playful wit. If needed, use the link provided to gather additional information, thus crafting a more comprehensive and captivating story. 

Your role is that of a charming and witty newsreader, delivering the news with a unique style that engages and delights your audience. Think of yourself as the master of playful banter, injecting clever humor and clever analogies into your presentation. Your refined yet accessible demeanor will be a signature of your content. 

If offering advice, adopt a playful and lighthearted tone, skillfully guiding your audience with clever metaphors and analogies. Your cunning wit can provide entertaining solutions while keeping the content moral and above board. 

Now, generate a catchy and playful viral title, using emojis to attract attention and set the tone for your unique news delivery. Additionally, provide a list of 10 relevant hashtags (excluding emojis) to enhance engagement and categorize your content effectively. 

Present your final output in a JSON format: 

 {
      "content": "The script generated using the instruction from above, feel free to include emojis as appropriate. Strictly DO NOT use any hashtags. Always maintain a sophisticated tone, refraining from foul language and casual phrases like 'well, well, well.' or words such as 'folks'. Remember no hashtags here and the content should fit within 60 seconds. Also, most importantly, remember to maintain a sophisticated sense of humor, using analogies and metaphors to enhance your content's appeal.",
      "uuid": "Generate random uuid",
      "title": "click bait title with emojis and 5 trending hashtags and #shorts (strictly at 100 char limit and the #shorts should be the first hashtag)",
      "tags": "15 trending related tags comma separated"
  }
  
  
Finally, Omit unnecessary responses like 'Here is the JSON...' or 'I can...'. Ensure valid JSON output.`;



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
                use_cache: false,
            }
        });

        instructions += response.generated_text;
        console.log(instructions);
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

async function processTranscription(transcriptionData, nbMaxNewTokens, uuid) {
    const outputFilePath = `${outputDir}/imageprompt_${uuid}.json`;

    if (fs.existsSync(outputFilePath)) {
        console.log(`Image prompt file already exists: ${outputFilePath}`);
        return outputFilePath;
    }

    const imagePromptsAndTimings = await generatePrompts(systemPrompt, transcriptionData, nbMaxNewTokens);

    console.log(imagePromptsAndTimings);

    fs.writeFileSync(outputFilePath, JSON.stringify(imagePromptsAndTimings, null, 2));

    return outputFilePath;
}

processTranscription("<item><title><![CDATA[ NHAI hikes tolls across highways by 5% ]]></title><description><![CDATA[ The change in toll fee is part of an annual exercise to revise the rates that are linked to the changes in the wholesale price index (CPI)-based inflation ]]></description><link><![CDATA[ https://www.thehindu.com/news/national/nhai-hikes-tolls-across-highways-by-5/article68245278.ece ]]></link><guid isPermaLink='false'>article-68245278</guid><category><![CDATA[ India ]]></category><pubDate><![CDATA[ Mon, 03 Jun 2024 07:34:59 +0530 ]]></pubDate><media:content height='675' medium='image' url='https://th-i.thgim.com/public/incoming/9mdgkd/article68245282.ece/alternates/LANDSCAPE_1200/VSP17_TOLL_PLAZA%202.JPG' width='1200'/></item>", 2000, "fadfasdfsfdasdf");

module.exports = { processTranscription };
const fs = require('fs').promises;

const convertCharToWordLevel = async (charData, outputFile) => {
  try {
    // Check if character data exists
    if (!charData.characters || !charData.character_start_times_seconds) {
      throw new Error("Character data is missing or incomplete");
    }

    // Initialize the word-level JSON structure
    const wordData = {
      systeminfo: charData.systeminfo || "",
      model: charData.model || {},
      params: charData.params || {},
      result: charData.result || {},
      transcription: []
    };

    // Helper function to join characters into words and calculate start time
    const aggregateToWords = (characters, startTimes) => {
      const words = [];
      let currentWord = "";
      let currentWordStartTimes = [];
      let wordLength = 0;

      characters.forEach((char, i) => {
        if (char === " " && currentWord) {
          if (wordLength + currentWord.trim().length <= 8) {
            currentWord += " ";
          } else {
            const midpoint = currentWordStartTimes[Math.floor(currentWordStartTimes.length / 2)];
            words.push({ text: currentWord.trim(), startInSeconds: midpoint });
            currentWord = "";
            currentWordStartTimes = [];
            wordLength = 0;
          }
        } else {
          if (!currentWord) {
            currentWordStartTimes.push(startTimes[i]);
          }
          currentWord += char;
          currentWordStartTimes.push(startTimes[i]);
          wordLength++;
        }
      });

      if (currentWord) {
        const midpoint = currentWordStartTimes[Math.floor(currentWordStartTimes.length / 2)];
        words.push({ text: currentWord.trim(), startInSeconds: midpoint });
      }

      return words;
    };

    // Aggregate characters into words
    const characters = charData.characters;
    const startTimes = charData.character_start_times_seconds;
    const words = aggregateToWords(characters, startTimes);

    // Add the words to the transcription
    wordData.transcription = words;

    // Save the word-level JSON file
    await fs.writeFile(outputFile, JSON.stringify(wordData, null, 4), 'utf8');

    console.log("Word-level JSON file has been created.");
  } catch (error) {
    console.error("Error:", error);
  }
};

module.exports = { convertCharToWordLevel };
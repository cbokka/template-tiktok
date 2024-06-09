const express = require('express');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const path = require('path');
const fs = require('fs').promises;
const { processTranscription } = require('./generatePrompts');
const { retryProcessPrompts, outputDir, preset, markImagesDownloadComplete } = require('./generateImages');
const { convertCharToWordLevel } = require('./gensub');
const webpackOverride = require('./src/webpack-override.js');

// Define the composition ID from your RemotionRoot
const compositionId = 'CaptionedVideo';

// Create an Express app
const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Function to render your video composition
const renderComposition = async (inputProps, uuid) => {
  try {
    console.log('Starting bundle process...');
    // Bundle the project
    const bundleLocation = await bundle({
      entryPoint: path.resolve('./src/index.ts'),
      webpackOverride,
    });

    console.log('Bundle process completed.');
    console.log('Selecting composition...');
    // Select the composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    // Ensure the output directory exists
    const outputLocation = `/mnt/disks/bbnews/output/final_${uuid}.mp4`;
    if (await fs.access(outputLocation).then(() => true).catch(() => false)) {
      console.log(`Video already exists: ${outputLocation}`);
      return outputLocation;
    }

    console.log('Starting render process...');
    // Render the media with progress logging
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation,
      inputProps,
      onProgress: (progress) => {
        console.log(`Rendering progress object: ${JSON.stringify(progress).progress}`);
      },
    });

    console.log('Render done!');
    return outputLocation;
  } catch (error) {
    console.error('Error rendering composition:', error);
    throw error;
  }
};

const generateSubtitles = async (charData, uuid) => {
  const subtitleFilePath = path.join('/mnt/disks/bbnews/public', `${uuid}_subtitles.json`);
  await convertCharToWordLevel(charData, subtitleFilePath);
  return subtitleFilePath;
};

const ensureDirExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
};

app.post('/render-video', async (req, res) => {
  const { filePath, systemPromptFile } = req.body;

  try {
    await ensureDirExists('/mnt/disks/bbnews');
    const jsonArray = JSON.parse(await fs.readFile(filePath, 'utf8'));

    for (let i = 0; i < jsonArray.length; i++) {
      const item = jsonArray[i];

      const videoFilePath = path.join('/mnt/disks/bbnews', `final_${item.uuid}.mp4`);
      if (await fs.access(videoFilePath).then(() => true).catch(() => false)) {
        console.log(`Skipping already processed item: ${videoFilePath}`);
        continue;
      }

      const subtitleFilePath = await generateSubtitles(item.charData, item.uuid);
      await ensureDirExists('/mnt/disks/bbnews');

      // Pass the systemPromptFile to processTranscription
      const systemPromptPath = path.join(systemPromptFile);
      const imagePromptFilePath = await processTranscription(subtitleFilePath, 2000, item.uuid, systemPromptPath);

      if (!item.imagesDownload || item.imagesDownload !== 'complete') {
        await retryProcessPrompts(imagePromptFilePath, 1024, 1024, outputDir, preset);
        await markImagesDownloadComplete(filePath, item.uuid);
      } else {
        console.log(`Images already downloaded for UUID: ${item.uuid}`);
      }

      const srcPath = path.join('./public', `${item.uuid}.mp4`);
      if (!await fs.access(srcPath).then(() => true).catch(() => false)) {
        throw new Error(`Source video file does not exist: ${srcPath}`);
      }

      // Extract the title without #tags
      const title = item.title.split(' #')[0].trim();
      const inputProps = {
        src: srcPath,
        videoTitle: title,
      };

      const renderedFilePath = await renderComposition(inputProps, item.uuid);
      item.videoFilePath = renderedFilePath;
    }

    await fs.writeFile(filePath, JSON.stringify(jsonArray, null, 2));
    console.log(`Updated JSON file saved to ${filePath}`);

    res.status(200).json({ message: 'Render done!' });
  } catch (error) {
    console.error('Error in render-video route:', error);
    res.status(500).json({ message: 'Error rendering video', error: error.message });
  }
});

// API endpoint to delete all .json, .mp4, and .mp3 files and the output folder in the public folder
app.delete('/cleanup', async (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  const outputDirPath = path.join(publicDir, 'output');

  try {
    // Delete all .json, .mp4, .mp3 files in the public directory
    const files = await fs.readdir(publicDir);
    for (const file of files) {
      const filePath = path.join(publicDir, file);
      if (file.endsWith('.json') || file.endsWith('.mp4') || file.endsWith('.mp3')) {
        await fs.unlink(filePath);
      }
    }

    // Delete the output directory and its contents
    if (await fs.access(outputDirPath).then(() => true).catch(() => false)) {
      const outputFiles = await fs.readdir(outputDirPath);
      for (const file of outputFiles) {
        const filePath = path.join(outputDirPath, file);
        await fs.unlink(filePath);
      }
      await fs.rmdir(outputDirPath);
    }

    res.status(200).json({ message: 'Cleanup successful!' });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ message: 'Error during cleanup', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
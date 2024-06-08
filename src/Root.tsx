import {Composition, staticFile} from 'remotion';
import {
	CaptionedVideo,
	calculateCaptionedVideoMetadata,
	captionedVideoSchema,
} from './CaptionedVideo';

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="CaptionedVideo"
			component={CaptionedVideo}
			calculateMetadata={calculateCaptionedVideoMetadata}
			schema={captionedVideoSchema}
			width={1080}
			height={1920}
			defaultProps={{
				src: staticFile('ae3dba23-55ef-48a2-aadc-cf07b138fc1a.mp4'),
				videoTitle: "Trump's Hypocrisy Hits New Lows! 🤯🗣️⚖️ "
			}}
		/>
	);
};

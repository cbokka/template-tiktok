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
				src: staticFile('8c3e761c-b8b8-4678-b881-40f4fbb5a91c.mp4'),
			}}
		/>
	);
};

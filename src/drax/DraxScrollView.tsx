import React, { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

import { DraxView } from './DraxView';
import { DraxSubprovider } from './DraxSubprovider';
import { useDraxId, useDraxAutoScroll } from './hooks';
import { DraxScrollViewProps } from './types';

export const DraxScrollView = ({
	children,
	style,
	scrollEventThrottle,
	onScroll,
	onContentSizeChange,
	id: idProp,
	...props
}: PropsWithChildren<DraxScrollViewProps>) => {
	// The unique identifer for this view.
	const id = useDraxId(idProp);

	// The derived sets of props and ref from auto-scroll system.
	const {
		draxViewProps,
		scrollViewProps,
		nodeHandleRef,
	} = useDraxAutoScroll({
		onScroll,
		onContentSizeChange,
		scrollEventThrottle,
	});

	return (
		<DraxView
			id={id}
			style={style}
			{...draxViewProps}
		>
			<DraxSubprovider parent={{ id, nodeHandleRef }}>
				<ScrollView
					{...props}
					{...scrollViewProps}
				>
					{children}
				</ScrollView>
			</DraxSubprovider>
		</DraxView>
	);
};

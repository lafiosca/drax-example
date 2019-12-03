import React, {
	PropsWithChildren,
	ReactElement,
	useState,
	useRef,
	useEffect,
	useCallback,
} from 'react';
import { Animated, ListRenderItem, ListRenderItemInfo } from 'react-native';
import {
	PanGestureHandlerStateChangeEvent,
	PanGestureHandlerGestureEvent,
	PanGestureHandler,
	FlatList,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';

import { DraxListProps } from './types';
import { DraxView } from './DraxView';

export const DraxList = <T extends unknown>(
	{
		renderItem,
		...props
	}: PropsWithChildren<DraxListProps<T>>,
): ReactElement => {
	const [id, setId] = useState(''); // The unique identifer for this list, initialized below.
	useEffect(() => { setId(uuid()); }, []); // Initialize id once.
	const renderDraxViewItem = useCallback(
		(info: ListRenderItemInfo<T>) => {
			const { index } = info;
			return (
				<DraxView
					payload={{ id, index }}
					onDragDrop={(payload: any) => {
						console.log(`Dragged ${index} onto ${payload.index}`);
					}}
					draggingStyle={{ backgroundColor: 'red' }}
					receivingStyle={{ backgroundColor: 'magenta' }}
				>
					{renderItem(info)}
				</DraxView>
			);
		},
		[renderItem, id],
	);
	return (
		<FlatList
			renderItem={renderDraxViewItem}
			{...props}
		/>
	);
};

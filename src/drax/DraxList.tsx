import React, {
	PropsWithChildren,
	ReactElement,
	useState,
	useRef,
	useEffect,
	useCallback,
} from 'react';
import {
	ListRenderItemInfo,
	NativeScrollEvent,
	NativeSyntheticEvent,
	FlatList,
	findNodeHandle,
} from 'react-native';
import uuid from 'uuid/v4';

import { DraxListProps, Position, DraxMonitorEventData } from './types';
import { DraxView } from './DraxView';

export const DraxList = <T extends unknown>(
	{
		renderItem,
		data,
		style,
		id: idProp,
		...props
	}: PropsWithChildren<DraxListProps<T>>,
): ReactElement => {
	const [id, setId] = useState(''); // The unique identifer for this list, initialized below.
	const nodeHandleRef = useRef<number | null>(null); // FlatList node handle, used for measuring children.
	const scrollPositionRef = useRef<Position>({ x: 0, y: 0 }); // Scroll position, for Drax bounds checking.

	// Initialize id.
	useEffect(
		() => {
			if (idProp) {
				if (id !== idProp) {
					setId(idProp);
				}
			} else if (!id) {
				setId(uuid());
			}
		},
		[id, idProp],
	);

	// Drax view renderItem wrapper.
	const renderDraxViewItem = useCallback(
		(info: ListRenderItemInfo<T>) => {
			const { index } = info;
			return (
				<DraxView
					payload={{ id, index }}
					onDragDrop={({ screenPosition, receiver: { payload } }) => {
						console.log(`Dragged [${id}: ${index}] onto [${payload.id}: ${payload.index}] at (${screenPosition.x}, ${screenPosition.y})`);
					}}
					draggingStyle={{ backgroundColor: 'red' }}
					receivingStyle={{ backgroundColor: 'magenta' }}
					parent={{ id, nodeHandleRef }}
				>
					{renderItem(info)}
				</DraxView>
			);
		},
		[id, renderItem],
	);

	// Update tracked scroll position when list is scrolled.
	const onScroll = useCallback(
		({ nativeEvent: { contentOffset } }: NativeSyntheticEvent<NativeScrollEvent>) => {
			scrollPositionRef.current = { ...contentOffset };
		},
		[],
	);

	// Monitor drags to see if we should scroll.
	const onMonitorDragOver = useCallback(
		(data: DraxMonitorEventData) => {
			console.log(`monitoring: ${JSON.stringify(data, null, 2)}`);
		},
		[],
	);

	return (
		<DraxView
			id={id}
			scrollPositionRef={scrollPositionRef}
			onMonitorDragOver={onMonitorDragOver}
			style={style}
		>
			<FlatList
				ref={(ref) => { nodeHandleRef.current = ref && findNodeHandle(ref); }}
				renderItem={renderDraxViewItem}
				onScroll={onScroll}
				data={id ? data : []}
				{...props}
			/>
		</DraxView>
	);
};

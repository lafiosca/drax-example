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

import { DraxListProps, ScrollPosition } from './types';
import { DraxView } from './DraxView';

export const DraxList = <T extends unknown>(
	{
		renderItem,
		data,
		id: idProp,
		...props
	}: PropsWithChildren<DraxListProps<T>>,
): ReactElement => {
	const [id, setId] = useState(''); // The unique identifer for this list, initialized below.
	const nodeHandleRef = useRef<number | null>(null); // FlatList node handle, used for measuring children.
	const scrollPositionRef = useRef<ScrollPosition>({ x: 0, y: 0 }); // Scroll position, for Drax bounds checking.

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
					onDragDrop={(payload: any) => {
						console.log(`Dragged ${index} onto ${payload.index}`);
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

	const onScroll = useCallback(
		({ nativeEvent: { contentOffset } }: NativeSyntheticEvent<NativeScrollEvent>) => {
			console.log(`Scrolled to ${JSON.stringify(contentOffset, null, 2)}`);
			scrollPositionRef.current = { ...contentOffset };
		},
		[],
	);

	return (
		<DraxView
			id={id}
			scrollPositionRef={scrollPositionRef}
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

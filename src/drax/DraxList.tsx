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

import {
	DraxListProps,
	DraxMonitorEventData,
	DraxListScrollState,
	Position,
} from './types';
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
	const { horizontal = false } = props;

	// The unique identifer for this list, initialized below.
	const [id, setId] = useState('');

	// FlatList, used for scrolling.
	const flatListRef = useRef<FlatList<T> | null>(null);

	// FlatList node handle, used for measuring children.
	const nodeHandleRef = useRef<number | null>(null);

	// Scroll position, for Drax bounds checking and auto-scrolling.
	const scrollPositionRef = useRef<Position>({ x: 0, y: 0 });

	// Auto-scrolling state.
	const scrollStateRef = useRef(DraxListScrollState.Inactive);

	// Auto-scrolling interval.
	const scrollIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

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
					payload={index}
					onDragDrop={({ screenPosition, receiver: { parentId, payload } }) => {
						console.log(`Dragged ${id}[${index}] onto ${parentId}[${payload}] at (${screenPosition.x}, ${screenPosition.y})`);
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

	// Handle auto-scrolling on interval.
	const doScroll = useCallback(
		() => {
			const flatList = flatListRef.current;
			if (!flatList) {
				return;
			}
			const prevOffset = horizontal
				? scrollPositionRef.current.x
				: scrollPositionRef.current.y;
			const increment = 12 * scrollStateRef.current;
			if (increment) {
				const offset = prevOffset + increment;
				console.log(`auto-scroll to ${offset}`);
				flatList.scrollToOffset({ offset });
				if (horizontal) {
					scrollPositionRef.current.x = offset;
				} else {
					scrollPositionRef.current.y = offset;
				}
			}
		},
		[horizontal],
	);

	// Start the auto-scrolling interval.
	const startScroll = useCallback(
		() => {
			console.log('start auto-scroll');
			if (scrollIntervalRef.current) {
				return;
			}
			scrollIntervalRef.current = setInterval(doScroll, 66);
		},
		[doScroll],
	);

	// Stop the auto-scrolling interval.
	const stopScroll = useCallback(
		() => {
			console.log('stop auto-scroll');
			if (scrollIntervalRef.current) {
				clearInterval(scrollIntervalRef.current);
				scrollIntervalRef.current = undefined;
			}
		},
		[],
	);

	// Whenever startScroll changes, refresh our interval.
	useEffect(
		() => {
			if (scrollIntervalRef.current) {
				stopScroll();
				startScroll();
			}
		},
		[stopScroll, startScroll],
	);

	// Monitor drags to see if we should scroll.
	const onMonitorDragOver = useCallback(
		({ relativePositionRatio }: DraxMonitorEventData) => {
			const ratio = horizontal ? relativePositionRatio.x : relativePositionRatio.y;
			if (ratio > 0.1 && ratio < 0.9) {
				scrollStateRef.current = DraxListScrollState.Inactive;
				stopScroll();
			} else {
				if (ratio >= 0.95) {
					scrollStateRef.current = DraxListScrollState.ForwardFast;
				} else if (ratio >= 0.9) {
					scrollStateRef.current = DraxListScrollState.ForwardSlow;
				} else if (ratio <= 0.05) {
					scrollStateRef.current = DraxListScrollState.BackFast;
				} else if (ratio <= 0.1) {
					scrollStateRef.current = DraxListScrollState.BackFast;
				}
				startScroll();
			}
		},
		[horizontal, stopScroll, startScroll],
	);

	// Monitor drag exits to stop scrolling.
	const onMonitorDragEnd = useCallback(
		() => {
			scrollStateRef.current = DraxListScrollState.Inactive;
			stopScroll();
		},
		[stopScroll],
	);

	return (
		<DraxView
			id={id}
			scrollPositionRef={scrollPositionRef}
			onMonitorDragOver={onMonitorDragOver}
			onMonitorDragExit={onMonitorDragEnd}
			onMonitorDragDrop={onMonitorDragEnd}
			style={style}
		>
			<FlatList
				ref={(ref) => {
					flatListRef.current = ref;
					nodeHandleRef.current = ref && findNodeHandle(ref);
				}}
				renderItem={renderDraxViewItem}
				onScroll={onScroll}
				data={id ? data : []}
				{...props}
			/>
		</DraxView>
	);
};

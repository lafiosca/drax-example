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
	DraxListScrollStatus,
	Position,
	DraxViewMeasurements,
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
): ReactElement | null => {
	const { horizontal = false } = props;

	// The unique identifer for this list, initialized below.
	const [id, setId] = useState('');

	// FlatList, used for scrolling.
	const flatListRef = useRef<FlatList<T> | null>(null);

	// FlatList node handle, used for measuring children.
	const nodeHandleRef = useRef<number | null>(null);

	// Container view measurements, for scrolling by percentage.
	const containerMeasurementsRef = useRef<DraxViewMeasurements | undefined>(undefined);

	// Content size, for scrolling by percentage.
	const contentSizeRef = useRef<Position | undefined>(undefined);

	// Scroll position, for Drax bounds checking and auto-scrolling.
	const scrollPositionRef = useRef<Position>({ x: 0, y: 0 });

	// Auto-scrolling state.
	const scrollStateRef = useRef(DraxListScrollStatus.Inactive);

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
					draggingStyle={{ opacity: 0.2 }}
					receivingStyle={{ backgroundColor: 'magenta' }}
					parent={{ id, nodeHandleRef }}
				>
					{renderItem(info)}
				</DraxView>
			);
		},
		[id, renderItem],
	);

	// Track the size of the container view.
	const onMeasureContainer = useCallback(
		(measurements: DraxViewMeasurements | undefined) => {
			containerMeasurementsRef.current = measurements;
		},
		[],
	);

	const onContentSizeChange = useCallback(
		(width: number, height: number) => {
			contentSizeRef.current = { x: width, y: height };
		},
		[],
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
			const containerMeasurements = containerMeasurementsRef.current;
			const contentSize = contentSizeRef.current;
			if (!flatList || !containerMeasurements || !contentSize) {
				return;
			}
			let containerLength: number;
			let contentLength: number;
			let prevOffset: number;
			if (horizontal) {
				containerLength = containerMeasurements.width;
				contentLength = contentSize.x;
				prevOffset = scrollPositionRef.current.x;
			} else {
				containerLength = containerMeasurements.height;
				contentLength = contentSize.y;
				prevOffset = scrollPositionRef.current.y;
			}
			const jumpLength = containerLength * 0.2;
			if (scrollStateRef.current === DraxListScrollStatus.Forward) {
				const maxOffset = contentLength - containerLength;
				if (prevOffset < maxOffset) {
					const offset = Math.min(prevOffset + jumpLength, maxOffset);
					flatList.scrollToOffset({ offset });
				}
			} else if (scrollStateRef.current === DraxListScrollStatus.Back) {
				if (prevOffset > 0) {
					const offset = Math.max(prevOffset - jumpLength, 0);
					flatList.scrollToOffset({ offset });
				}
			}
		},
		[horizontal],
	);

	// Start the auto-scrolling interval.
	const startScroll = useCallback(
		() => {
			if (scrollIntervalRef.current) {
				return;
			}
			doScroll();
			scrollIntervalRef.current = setInterval(doScroll, 250);
		},
		[doScroll],
	);

	// Stop the auto-scrolling interval.
	const stopScroll = useCallback(
		() => {
			if (scrollIntervalRef.current) {
				clearInterval(scrollIntervalRef.current);
				scrollIntervalRef.current = undefined;
			}
		},
		[],
	);

	// If startScroll changes, refresh our interval.
	useEffect(
		() => {
			if (scrollIntervalRef.current) {
				stopScroll();
				startScroll();
			}
		},
		[stopScroll, startScroll],
	);

	// Monitor drags to react.
	const onMonitorDragOver = useCallback(
		({ dragged, relativePositionRatio }: DraxMonitorEventData) => {
			// First check if the dragged view is one of our list items.
			if (dragged.parentId === id) {
				// It is one of our list items.
				const index: number = dragged.payload;
			} else {
				// It's an external view.
			}
			const ratio = horizontal ? relativePositionRatio.x : relativePositionRatio.y;
			if (ratio > 0.1 && ratio < 0.9) {
				scrollStateRef.current = DraxListScrollStatus.Inactive;
				stopScroll();
			} else {
				if (ratio >= 0.9) {
					scrollStateRef.current = DraxListScrollStatus.Forward;
				} else if (ratio <= 0.1) {
					scrollStateRef.current = DraxListScrollStatus.Back;
				}
				startScroll();
			}
		},
		[id, horizontal, stopScroll, startScroll],
	);

	// Monitor drag exits to stop scrolling.
	const onMonitorDragEnd = useCallback(
		() => {
			scrollStateRef.current = DraxListScrollStatus.Inactive;
			stopScroll();
		},
		[stopScroll],
	);

	return id ? (
		<DraxView
			id={id}
			scrollPositionRef={scrollPositionRef}
			onMeasure={onMeasureContainer}
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
				onContentSizeChange={onContentSizeChange}
				data={id ? data : []}
				{...props}
			/>
		</DraxView>
	) : null;
};

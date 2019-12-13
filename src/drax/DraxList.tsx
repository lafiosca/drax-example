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
	Animated,
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

interface Shift {
	targetValue: number;
	animatedValue: Animated.Value;
}

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
	const itemCount = data?.length ?? 0;

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

	// List item measurements, for determining shift.
	const measurementsRef = useRef<(DraxViewMeasurements | undefined)[]>([]);

	// Shift offsets.
	const shiftsRef = useRef<Shift[]>([]);


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

	// Adjust measurements and shift value arrays as item count changes.
	useEffect(
		() => {
			const measurements = measurementsRef.current;
			const shifts = shiftsRef.current;
			if (measurements.length > itemCount) {
				measurements.splice(itemCount - measurements.length);
			} else {
				while (measurements.length < itemCount) {
					measurements.push(undefined);
				}
			}
			if (shifts.length > itemCount) {
				shifts.splice(itemCount - shifts.length);
			} else {
				while (shifts.length < itemCount) {
					shifts.push({
						targetValue: 0,
						animatedValue: new Animated.Value(0),
					});
				}
			}
		},
		[itemCount],
	);

	// Get shift transform for list item at index.
	const getShiftTransform = useCallback(
		(index: number) => {
			const shift = shiftsRef.current[index].animatedValue;
			return horizontal
				? [{ translateX: shift }]
				: [{ translateY: shift }];
		},
		[horizontal],
	);

	// Drax view renderItem wrapper.
	const renderDraxViewItem = useCallback(
		(info: ListRenderItemInfo<T>) => {
			const { index } = info;

			return (
				<DraxView
					style={{ transform: getShiftTransform(index) }}
					payload={index}
					onMeasure={(measurements) => {
						measurementsRef.current[index] = measurements;
					}}
					onDragDrop={({ screenPosition, receiver: { parentId, payload } }) => {
						console.log(`Dragged ${id}[${index}] onto ${parentId}[${payload}] at (${screenPosition.x}, ${screenPosition.y})`);
					}}
					draggingStyle={{ opacity: 0.2 }}
					dragReleasedStyle={{ opacity: 0.2 }}
					hoverStyle={{ backgroundColor: 'blue' }}
					hoverDraggingStyle={{ backgroundColor: 'red' }}
					receivingStyle={{ backgroundColor: 'magenta' }}
					parent={{ id, nodeHandleRef }}
				>
					{renderItem(info)}
				</DraxView>
			);
		},
		[id, getShiftTransform, renderItem],
	);

	// Track the size of the container view.
	const onMeasureContainer = useCallback(
		(measurements: DraxViewMeasurements | undefined) => {
			containerMeasurementsRef.current = measurements;
		},
		[],
	);

	// Track the size of the content.
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

	// Reset all shift values.
	const resetShifts = useCallback(
		() => {
			shiftsRef.current.forEach((shift) => {
				if (shift.targetValue !== 0) {
					shift.targetValue = 0;
					Animated.timing(shift.animatedValue, { toValue: 0 }).start();
				}
			});
		},
		[],
	);

	// Update shift values in response to a drag.
	const updateShifts = useCallback(
		(draggedIndex: number, atIndex: number) => {
			const { width = 50, height = 50 } = measurementsRef.current[draggedIndex] ?? {};
			const offset = horizontal ? width : height;
			shiftsRef.current.forEach((shift, index) => {
				let newTargetValue = 0;
				if (index > draggedIndex && index <= atIndex) {
					newTargetValue = -offset;
				} else if (index < draggedIndex && index >= atIndex) {
					newTargetValue = offset;
				}
				if (shift.targetValue !== newTargetValue) {
					shift.targetValue = newTargetValue;
					Animated.timing(shift.animatedValue, {
						duration: 200,
						toValue: newTargetValue,
					}).start();
				}
			});
		},
		[horizontal],
	);

	// Monitor drags to react.
	const onMonitorDragOver = useCallback(
		({ dragged, receiver, relativePositionRatio }: DraxMonitorEventData) => {
			if (dragged.parentId === id) {
				// One of our list items is being dragged.
				const draggedIndex: number = dragged.payload;
				// Find its current index in the list for the purpose of shifting.
				const atIndex: number = receiver?.parentId === id
					? receiver.payload
					: draggedIndex;
				updateShifts(
					draggedIndex,
					atIndex,
					{
						x: 0,
						y: 0,
						width: 50,
						height: 50,
					},
				);
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
		[
			id,
			updateShifts,
			horizontal,
			stopScroll,
			startScroll,
		],
	);

	// Monitor drag exits to stop scrolling.
	const onMonitorDragEnd = useCallback(
		({ dragged }: DraxMonitorEventData) => {
			if (dragged.parentId === id) {
				resetShifts();
			}
			scrollStateRef.current = DraxListScrollStatus.Inactive;
			stopScroll();
		},
		[id, resetShifts, stopScroll],
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

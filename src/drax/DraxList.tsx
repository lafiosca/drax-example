import React, {
	PropsWithChildren,
	ReactElement,
	useState,
	useRef,
	useEffect,
	useCallback,
	useMemo,
	useLayoutEffect,
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
	DraxMonitorDragDropEventData,
	DraxMonitorEndEventData,
	DraxViewRegistration,
	DraxEventViewData,
	DraxProtocolDragEndResponse,
	DraxSnapbackTargetPreset,
} from './types';
import { DraxView } from './DraxView';

interface Shift {
	targetValue: number;
	animatedValue: Animated.Value;
}

interface ListItemPayload {
	index: number;
	originalIndex: number;
}

export const DraxList = <T extends unknown>(
	{
		renderItem,
		data,
		style,
		onListItemMoved,
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

	// Drax view registrations, for remeasuring after reorder.
	const registrationsRef = useRef<(DraxViewRegistration | undefined)[]>([]);

	// Shift offsets.
	const shiftsRef = useRef<Shift[]>([]);

	// Maintain cache of reordered list indexes until data updates.
	const [originalIndexes, setOriginalIndexes] = useState<number[]>([]);

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
			const registrations = registrationsRef.current;
			const shifts = shiftsRef.current;
			if (measurements.length > itemCount) {
				measurements.splice(itemCount - measurements.length);
				registrations.splice(itemCount - registrations.length);
				shifts.splice(itemCount - shifts.length);
			} else {
				while (measurements.length < itemCount) {
					measurements.push(undefined);
					registrations.push(undefined);
					shifts.push({
						targetValue: 0,
						animatedValue: new Animated.Value(0),
					});
				}
			}
		},
		[itemCount],
	);

	// Clear reorders when data changes, but wait for drag to complete.
	useLayoutEffect(
		() => {
			console.log('clear reorders');
			setOriginalIndexes(data ? [...Array(data.length).keys()] : []);
		},
		[data],
	);

	// Apply the reorder cache to the data.
	const reorderedData = useMemo(
		() => {
			console.log('refresh sorted data');
			if (!id || data === null) {
				return null;
			}
			return originalIndexes.map((index) => data[index]);
		},
		[id, data, originalIndexes],
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
			const originalIndex = originalIndexes[index];

			return (
				<DraxView
					style={{ transform: getShiftTransform(originalIndex) }}
					payload={{ index, originalIndex }}
					onMeasure={(measurements) => {
						console.log(`measuring [${index}, ${originalIndex}]: (${measurements?.x}, ${measurements?.y})`);
						measurementsRef.current[originalIndex] = measurements;
					}}
					registration={(registration) => {
						if (registration) {
							console.log(`registering [${index}, ${originalIndex}], ${registration.id}`);
							registrationsRef.current[originalIndex] = registration;
							registration.measure();
						}
					}}
					draggingStyle={{ opacity: 0 }}
					dragReleasedStyle={{ opacity: 0.5 }}
					hoverStyle={{ backgroundColor: 'blue' }}
					hoverDraggingStyle={{ backgroundColor: 'red' }}
					parent={{ id, nodeHandleRef }}
				>
					{renderItem(info)}
				</DraxView>
			);
		},
		[
			id,
			originalIndexes,
			getShiftTransform,
			renderItem,
		],
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
				shift.animatedValue.setValue(0);
			});
		},
		[],
	);

	// Update shift values in response to a drag.
	const updateShifts = useCallback(
		(
			{ index: fromIndex, originalIndex: fromOriginalIndex }: ListItemPayload,
			{ index: toIndex }: ListItemPayload,
		) => {
			const { width = 50, height = 50 } = measurementsRef.current[fromOriginalIndex] ?? {};
			const offset = horizontal ? width : height;
			originalIndexes.forEach((originalIndex, index) => {
				const shift = shiftsRef.current[originalIndex];
				let newTargetValue = 0;
				if (index > fromIndex && index <= toIndex) {
					newTargetValue = -offset;
				} else if (index < fromIndex && index >= toIndex) {
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
		[originalIndexes, horizontal],
	);

	// Calculate screen position of list item for snapback.
	const calculateSnapbackTarget = useCallback(
		(index: number) => {
			const containerMeasurements = containerMeasurementsRef.current;
			if (containerMeasurements) {
				const measurements = measurementsRef.current[index];
				if (measurements) {
					const scrollPosition = scrollPositionRef.current;
					return {
						x: containerMeasurements.x - scrollPosition.x + measurements.x,
						y: containerMeasurements.y - scrollPosition.y + measurements.y,
					};
				}
			}
			return DraxSnapbackTargetPreset.None;
		},
		[],
	);

	// Stop scrolling, and potentially update shifts and reorder data.
	const handleDragEnd = useCallback(
		(
			dragged?: DraxEventViewData,
			receiver?: DraxEventViewData,
		): DraxProtocolDragEndResponse => {
			// Always stop auto-scroll on drag end.
			scrollStateRef.current = DraxListScrollStatus.Inactive;
			stopScroll();

			// Determine list indexes of dragged/received items, if any.
			const fromIndex = dragged && (dragged.parentId === id)
				? (dragged.payload as ListItemPayload).index
				: undefined;
			const toIndex = (fromIndex !== undefined && receiver && receiver.parentId === id)
				? (receiver.payload as ListItemPayload).index
				: undefined;

			if (fromIndex !== undefined) {
				// If dragged item was ours, reset shifts.
				resetShifts();
				if (toIndex !== undefined) {
					// If dragged item and received item were ours, reorder data.
					console.log(`moving ${fromIndex} -> ${toIndex}`);
					const snapbackTarget = calculateSnapbackTarget(originalIndexes[toIndex]);
					const newOriginalIndexes = originalIndexes.slice();
					newOriginalIndexes.splice(toIndex, 0, newOriginalIndexes.splice(fromIndex, 1)[0]);
					setOriginalIndexes(newOriginalIndexes);
					onListItemMoved?.(fromIndex, toIndex);
					return snapbackTarget;
				}
			}

			return undefined;
		},
		[
			id,
			stopScroll,
			resetShifts,
			calculateSnapbackTarget,
			originalIndexes,
			onListItemMoved,
		],
	);

	// Monitor drags to react with item shifts and auto-scrolling.
	const onMonitorDragOver = useCallback(
		({ dragged, receiver, relativePositionRatio }: DraxMonitorEventData) => {
			// First, check if we need to shift items.
			if (dragged.parentId === id) {
				// One of our list items is being dragged.
				const fromPayload: ListItemPayload = dragged.payload;
				// Find its current index in the list for the purpose of shifting.
				const toPayload: ListItemPayload = receiver?.parentId === id
					? receiver.payload
					: fromPayload;
				updateShifts(fromPayload, toPayload);
			}

			// Next, see if we need to auto-scroll.
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

	// Monitor drag exits to stop scrolling, update shifts, and possibly reorder.
	const onMonitorDragExit = useCallback(
		({ dragged }: DraxMonitorEventData) => handleDragEnd(dragged),
		[handleDragEnd],
	);

	/*
	 * Monitor drag ends to stop scrolling, update shifts, and possibly reorder.
	 * This addresses the Android case where if we drag a list item and auto-scroll
	 * too far, the drag gets cancelled.
	 */
	const onMonitorDragEnd = useCallback(
		({ dragged, receiver }: DraxMonitorEndEventData) => handleDragEnd(dragged, receiver),
		[handleDragEnd],
	);

	// Monitor drag drops to stop scrolling, update shifts, and possibly reorder.
	const onMonitorDragDrop = useCallback(
		({ dragged, receiver }: DraxMonitorDragDropEventData) => handleDragEnd(dragged, receiver),
		[handleDragEnd],
	);

	return id ? (
		<DraxView
			id={id}
			scrollPositionRef={scrollPositionRef}
			onMeasure={onMeasureContainer}
			onMonitorDragOver={onMonitorDragOver}
			onMonitorDragExit={onMonitorDragExit}
			onMonitorDragEnd={onMonitorDragEnd}
			onMonitorDragDrop={onMonitorDragDrop}
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
				data={reorderedData}
				{...props}
			/>
		</DraxView>
	) : null;
};

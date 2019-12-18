import { useRef, useCallback, useEffect } from 'react';
import { ScrollView, NativeSyntheticEvent, NativeScrollEvent, ScrollViewProps, findNodeHandle } from 'react-native';

import {
	DraxViewMeasurements,
	AutoScrollState,
	Position,
	AutoScrollDirection,
	DraxMonitorEventData,
	DraxViewProps,
	DraxMonitorEndEventData,
	DraxMonitorDragDropEventData,
} from '../types';
import {
	defaultAutoScrollIntervalLength,
	defaultAutoScrollJumpRatio,
	defaultAutoScrollBackThreshold,
	defaultAutoScrollForwardThreshold,
	defaultScrollEventThrottle,
} from '../params';

type ScrollPropOverride = 'onScroll' | 'scrollEventThrottle' | 'onContentSizeChange';
type DraxViewPropOverride = 'onMeasure' | 'onMonitorDragOver' | 'onMonitorDragExit' | 'onMonitorDragEnd' | 'onMonitorDragDrop';

interface AutoScrollOptions extends
	Pick<ScrollViewProps, ScrollPropOverride>,
	Pick<DraxViewProps, DraxViewPropOverride> {
	autoScrollIntervalLength?: number;
	autoScrollJumpRatio?: number;
	autoScrollBackThreshold?: number;
	autoScrollForwardThreshold?: number;
}

export const useDraxAutoScroll = ({
	onScroll: onScrollProp,
	onContentSizeChange: onContentSizeChangeProp,
	onMeasure: onMeasureProp,
	onMonitorDragOver: onMonitorDragOverProp,
	onMonitorDragExit: onMonitorDragExitProp,
	onMonitorDragEnd: onMonitorDragEndProp,
	onMonitorDragDrop: onMonitorDragDropProp,
	scrollEventThrottle = defaultScrollEventThrottle,
	autoScrollIntervalLength = defaultAutoScrollIntervalLength,
	autoScrollJumpRatio = defaultAutoScrollJumpRatio,
	autoScrollBackThreshold = defaultAutoScrollBackThreshold,
	autoScrollForwardThreshold = defaultAutoScrollForwardThreshold,
}: AutoScrollOptions = {}) => {
	// ScrollView, used for scrolling.
	const scrollViewRef = useRef<ScrollView | null>(null);

	// ScrollView node handle, used for measuring children.
	const nodeHandleRef = useRef<number | null>(null);

	// Container view measurements, for scrolling by percentage.
	const containerMeasurementsRef = useRef<DraxViewMeasurements | undefined>(undefined);

	// Content size, for scrolling by percentage.
	const contentSizeRef = useRef<Position | undefined>(undefined);

	// Scroll position, for Drax bounds checking and auto-scrolling.
	const scrollPositionRef = useRef<Position>({ x: 0, y: 0 });

	// Auto-scroll state.
	const autoScrollStateRef = useRef<AutoScrollState>({
		x: AutoScrollDirection.None,
		y: AutoScrollDirection.None,
	});

	// Auto-scroll interval.
	const autoScrollIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

	// Track the size of the container view.
	const onMeasure = useCallback(
		(measurements: DraxViewMeasurements | undefined) => {
			containerMeasurementsRef.current = measurements;
			onMeasureProp?.(measurements);
		},
		[onMeasureProp],
	);

	// Set the scroll view and node handle refs.
	const setScrollViewRef = useCallback(
		(ref: ScrollView | null) => {
			scrollViewRef.current = ref;
			nodeHandleRef.current = ref && findNodeHandle(ref);
		},
		[],
	);

	// Track the size of the content.
	const onContentSizeChange = useCallback(
		(width: number, height: number) => {
			contentSizeRef.current = { x: width, y: height };
			onContentSizeChangeProp?.(width, height);
		},
		[onContentSizeChangeProp],
	);

	// Update tracked scroll position when list is scrolled.
	const onScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const { nativeEvent: { contentOffset } } = event;
			scrollPositionRef.current = { ...contentOffset };
			onScrollProp?.(event);
		},
		[onScrollProp],
	);

	// Handle auto-scrolling on interval.
	const doScroll = useCallback(
		() => {
			const scrollView = scrollViewRef.current;
			const containerMeasurements = containerMeasurementsRef.current;
			const contentSize = contentSizeRef.current;
			if (!scrollView || !containerMeasurements || !contentSize) {
				return;
			}
			const scrollPosition = scrollPositionRef.current;
			const autoScrollState = autoScrollStateRef.current;
			const jump = {
				x: containerMeasurements.width * autoScrollJumpRatio,
				y: containerMeasurements.height * autoScrollJumpRatio,
			};
			let xNew: number | undefined;
			let yNew: number | undefined;
			if (autoScrollState.x === AutoScrollDirection.Forward) {
				const xMax = contentSize.x - containerMeasurements.width;
				if (scrollPosition.x < xMax) {
					xNew = Math.min(scrollPosition.x + jump.x, xMax);
				}
			} else if (autoScrollState.x === AutoScrollDirection.Back) {
				if (scrollPosition.x > 0) {
					xNew = Math.max(scrollPosition.x - jump.x, 0);
				}
			}
			if (autoScrollState.y === AutoScrollDirection.Forward) {
				const yMax = contentSize.y - containerMeasurements.width;
				if (scrollPosition.y < yMax) {
					yNew = Math.min(scrollPosition.y + jump.y, yMax);
				}
			} else if (autoScrollState.y === AutoScrollDirection.Back) {
				if (scrollPosition.y > 0) {
					yNew = Math.max(scrollPosition.y - jump.y, 0);
				}
			}
			if (xNew !== undefined || yNew !== undefined) {
				scrollView.scrollTo({
					x: xNew ?? scrollPosition.x,
					y: yNew ?? scrollPosition.y,
				});
			}
		},
		[autoScrollJumpRatio],
	);

	// Start the auto-scrolling interval.
	const startScroll = useCallback(
		() => {
			if (autoScrollIntervalRef.current) {
				return;
			}
			doScroll();
			autoScrollIntervalRef.current = setInterval(doScroll, autoScrollIntervalLength);
		},
		[doScroll, autoScrollIntervalLength],
	);

	// Stop the auto-scrolling interval.
	const stopScroll = useCallback(
		() => {
			if (autoScrollIntervalRef.current) {
				clearInterval(autoScrollIntervalRef.current);
				autoScrollIntervalRef.current = undefined;
			}
		},
		[],
	);

	// If startScroll changes, refresh our interval.
	useEffect(
		() => {
			if (autoScrollIntervalRef.current) {
				stopScroll();
				startScroll();
			}
		},
		[stopScroll, startScroll],
	);

	// Clear auto-scroll direction and stop the auto-scrolling interval.
	const resetScroll = useCallback(
		() => {
			autoScrollStateRef.current = {
				x: AutoScrollDirection.None,
				y: AutoScrollDirection.None,
			};
			stopScroll();
		},
		[stopScroll],
	);

	// Handle monitor drag-over event to react with auto-scrolling.
	const onMonitorDragOver = useCallback(
		(event: DraxMonitorEventData) => {
			const { relativePositionRatio } = event;
			const autoScrollState = autoScrollStateRef.current;
			if (relativePositionRatio.x >= autoScrollForwardThreshold) {
				autoScrollState.x = AutoScrollDirection.Forward;
			} else if (relativePositionRatio.x <= autoScrollBackThreshold) {
				autoScrollState.x = AutoScrollDirection.Back;
			} else {
				autoScrollState.x = AutoScrollDirection.None;
			}
			if (relativePositionRatio.y >= autoScrollForwardThreshold) {
				autoScrollState.y = AutoScrollDirection.Forward;
			} else if (relativePositionRatio.y <= autoScrollBackThreshold) {
				autoScrollState.y = AutoScrollDirection.Back;
			} else {
				autoScrollState.y = AutoScrollDirection.None;
			}
			if (autoScrollState.x === AutoScrollDirection.None && autoScrollState.y === AutoScrollDirection.None) {
				stopScroll();
			} else {
				startScroll();
			}
			onMonitorDragOverProp?.(event);
		},
		[
			stopScroll,
			startScroll,
			autoScrollBackThreshold,
			autoScrollForwardThreshold,
			onMonitorDragOverProp,
		],
	);

	// Handle monitor drag exit event to reset auto-scrolling.
	const onMonitorDragExit = useCallback(
		(event: DraxMonitorEventData) => {
			resetScroll();
			onMonitorDragExitProp?.(event);
		},
		[resetScroll, onMonitorDragExitProp],
	);

	// Handle monitor drag end event to reset auto-scrolling.
	const onMonitorDragEnd = useCallback(
		(event: DraxMonitorEndEventData) => {
			resetScroll();
			onMonitorDragEndProp?.(event);
		},
		[resetScroll, onMonitorDragEndProp],
	);

	// Handle monitor drag drop event to reset auto-scrolling.
	const onMonitorDragDrop = useCallback(
		(event: DraxMonitorDragDropEventData) => {
			resetScroll();
			onMonitorDragDropProp?.(event);
		},
		[resetScroll, onMonitorDragDropProp],
	);

	return {
		draxViewProps: {
			scrollPositionRef,
			onMeasure,
			onMonitorDragOver,
			onMonitorDragExit,
			onMonitorDragEnd,
			onMonitorDragDrop,
		},
		scrollViewProps: {
			onScroll,
			scrollEventThrottle,
			onContentSizeChange,
			ref: setScrollViewRef,
		},
		scrollPositionRef,
		nodeHandleRef,
		containerMeasurementsRef,
		contentSizeRef,
	};
};

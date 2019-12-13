import React, {
	PropsWithChildren,
	ReactElement,
	useState,
	useRef,
	useEffect,
	useCallback,
} from 'react';
import { Animated } from 'react-native';
import {
	LongPressGestureHandlerStateChangeEvent,
	LongPressGestureHandler,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';
import throttle from 'lodash.throttle';

import { useDrax } from './useDrax';
import {
	LongPressGestureHandlerGestureEvent,
	DraxViewProps,
	AnimatedViewRefType,
	DraxViewDragStatus,
	DraxViewReceiveStatus,
	DraxGestureEvent,
} from './types';
import { defaultLongPressDelay } from './params';

const defaultStyle = {
	width: 'auto',
	height: 'auto',
};

export const DraxView = (
	{
		onDragStart,
		onDrag,
		onDragEnter,
		onDragOver,
		onDragExit,
		onDragEnd,
		onDragDrop,
		onReceiveDragEnter,
		onReceiveDragOver,
		onReceiveDragExit,
		onReceiveDragDrop,
		onMonitorDragEnter,
		onMonitorDragOver,
		onMonitorDragExit,
		onMonitorDragDrop,
		dragReleaseAnimationDelay,
		dragReleaseAnimationDuration,
		payload,
		dragPayload,
		receiverPayload,
		style,
		dragInactiveStyle,
		draggingStyle,
		draggingWithReceiverStyle,
		draggingWithoutReceiverStyle,
		dragReleasedStyle,
		receiverInactiveStyle,
		receivingStyle,
		otherDraggingStyle,
		otherDraggingWithReceiverStyle,
		otherDraggingWithoutReceiverStyle,
		registration,
		onMeasure,
		parent,
		scrollPositionRef,
		children,
		longPressDelay = defaultLongPressDelay,
		id: idProp,
		draggable: draggableProp,
		receptive: receptiveProp,
		monitoring: monitoringProp,
		...props
	}: PropsWithChildren<DraxViewProps>,
): ReactElement => {
	// Coalesce protocol props into capabilities.
	const draggable = draggableProp ?? (
		dragPayload !== undefined
		|| payload !== undefined
		|| !!onDrag
		|| !!onDragEnd
		|| !!onDragEnter
		|| !!onDragExit
		|| !!onDragOver
		|| !!onDragStart
		|| !!onDragDrop
	);
	const receptive = receptiveProp ?? (
		receiverPayload !== undefined
		|| payload !== undefined
		|| !!onReceiveDragEnter
		|| !!onReceiveDragExit
		|| !!onReceiveDragOver
		|| !!onReceiveDragDrop
	);
	const monitoring = monitoringProp ?? (
		!!onMonitorDragEnter
		|| !!onMonitorDragExit
		|| !!onMonitorDragOver
		|| !!onMonitorDragDrop
	);

	// The parent Drax view id, if it exists.
	const parentId = parent && parent.id;

	// The unique identifer for this view, initialized below.
	const [id, setId] = useState('');

	// The underlying Animated.View, for measuring.
	const viewRef = useRef<AnimatedViewRefType>(null);

	// Connect with Drax.
	const {
		getViewState,
		getTrackingStatus,
		registerView,
		unregisterView,
		updateViewProtocol,
		updateViewMeasurements,
		handleGestureEvent,
		handleGestureStateChange,
	} = useDrax();

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

	// Register and unregister with Drax context when necessary.
	useEffect(
		() => {
			if (id) {
				// Register with Drax context after we have an id.
				registerView({ id, parentId, scrollPositionRef });

				// Unregister when we unmount.
				return () => unregisterView({ id });
			}
			return undefined;
		},
		[
			id,
			parentId,
			scrollPositionRef,
			registerView,
			unregisterView,
		],
	);

	// Report updates to our protocol callbacks when we have an id and whenever the props change.
	useEffect(
		() => {
			if (id) {
				const renderHoverView = draggable
					? (() => children)
					: undefined;
				updateViewProtocol({
					id,
					protocol: {
						onDragStart,
						onDrag,
						onDragEnter,
						onDragOver,
						onDragExit,
						onDragEnd,
						onDragDrop,
						onReceiveDragEnter,
						onReceiveDragOver,
						onReceiveDragExit,
						onReceiveDragDrop,
						onMonitorDragEnter,
						onMonitorDragOver,
						onMonitorDragExit,
						onMonitorDragDrop,
						dragReleaseAnimationDelay,
						dragReleaseAnimationDuration,
						renderHoverView,
						draggable,
						receptive,
						monitoring,
						dragPayload: dragPayload ?? payload,
						receiverPayload: receiverPayload ?? payload,
					},
				});
			}
		},
		[
			id,
			updateViewProtocol,
			children,
			onDragStart,
			onDrag,
			onDragEnter,
			onDragOver,
			onDragExit,
			onDragEnd,
			onDragDrop,
			onReceiveDragEnter,
			onReceiveDragOver,
			onReceiveDragExit,
			onReceiveDragDrop,
			onMonitorDragEnter,
			onMonitorDragOver,
			onMonitorDragExit,
			onMonitorDragDrop,
			dragReleaseAnimationDelay,
			dragReleaseAnimationDuration,
			payload,
			dragPayload,
			receiverPayload,
			draggable,
			receptive,
			monitoring,
		],
	);

	// Connect gesture state change handling into Drax context, tied to this id.
	const onHandlerStateChange = useCallback(
		({ nativeEvent }: LongPressGestureHandlerStateChangeEvent) => handleGestureStateChange(id, nativeEvent),
		[id, handleGestureStateChange],
	);

	// Create throttled gesture event handler, tied to this id.
	const throttledHandleGestureEvent = useCallback(
		throttle(
			(event: DraxGestureEvent) => {
				// Pass the event up to the Drax context.
				handleGestureEvent(id, event);
			},
			33,
		),
		[id, handleGestureEvent],
	);

	// Connect gesture event handling into Drax context, extracting nativeEvent.
	const onGestureEvent = useCallback(
		(event: LongPressGestureHandlerGestureEvent) => throttledHandleGestureEvent(event.nativeEvent),
		[throttledHandleGestureEvent],
	);

	// Report our measurements to Drax context.
	const updateMeasurements = useCallback(
		(x, y, width, height) => {
			/*
			 * In certain cases (on Android), all of these values can be
			 * undefined when the view is not on screen; This should not
			 * happen with the measurement functions we're using, but just
			 * for the sake of paranoia, we'll check and send undefined
			 * for the entire measurements object.
			 */
			const measurements = (height === undefined
				? undefined
				: {
					x,
					y,
					width,
					height,
				}
			);
			updateViewMeasurements({ id, measurements });
			onMeasure?.(measurements);
		},
		[id, updateViewMeasurements, onMeasure],
	);

	/*
	 * Measure and send our measurements to Drax context, used when
	 * we finish layout or receive a manual request,
	 */
	const measure = useCallback(
		() => {
			const view = viewRef.current?.getNode();
			if (parent) {
				const nodeHandle = parent.nodeHandleRef.current;
				if (nodeHandle) {
					view?.measureLayout(
						nodeHandle,
						updateMeasurements,
						() => {
							console.log('Failed to measure drax view in relation to parent');
						},
					);
				} else {
					console.log('No parent nodeHandle to measure drax view in relation to');
				}
			} else {
				viewRef.current?.getNode().measureInWindow(updateMeasurements);
			}
		},
		[parent, updateMeasurements],
	);

	// Register and unregister externally when necessary.
	useEffect(
		() => {
			if (id && registration) { // Register externally when we have an id and registration is set.
				registration({
					id,
					measure,
				});
				return () => registration(undefined); // Unregister when we unmount or registration changes.
			}
			return undefined;
		},
		[id, registration, measure],
	);

	useEffect(
		() => {
			console.log('throttle function replaced');
		},
		[throttledHandleGestureEvent],
	);

	// Retrieve data for building styles.
	const viewState = getViewState(id);
	const { dragging, receiving } = getTrackingStatus();

	// Use `any[]` here because the view style typings don't account for animated views.
	const styles: any[] = [
		defaultStyle,
		style,
	];

	if (viewState) {
		// First apply style overrides for drag state.
		if (viewState.dragStatus === DraxViewDragStatus.Dragging) {
			styles.push(draggingStyle);
			if (receiving) {
				styles.push(draggingWithReceiverStyle);
			} else {
				styles.push(draggingWithoutReceiverStyle);
			}
		} else if (viewState.dragStatus === DraxViewDragStatus.Released) {
			styles.push(dragReleasedStyle);
		} else {
			styles.push(dragInactiveStyle);
			if (dragging) {
				styles.push(otherDraggingStyle);
				if (receiving) {
					styles.push(otherDraggingWithReceiverStyle);
				} else {
					styles.push(otherDraggingWithoutReceiverStyle);
				}
			}
		}

		// Next apply style overrides for receiving state.
		if (viewState.receiveStatus === DraxViewReceiveStatus.Receiving) {
			styles.push(receivingStyle);
		} else {
			styles.push(receiverInactiveStyle);
		}
	}

	return (
		<LongPressGestureHandler
			maxDist={Number.MAX_SAFE_INTEGER}
			shouldCancelWhenOutside={false}
			minDurationMs={longPressDelay}
			onHandlerStateChange={onHandlerStateChange}
			onGestureEvent={onGestureEvent as any /* Workaround incorrect typings. */}
			enabled={draggable}
		>
			<Animated.View
				{...props}
				ref={viewRef}
				style={styles}
				onLayout={measure}
				collapsable={false}
			>
				{children}
			</Animated.View>
		</LongPressGestureHandler>
	);
};
